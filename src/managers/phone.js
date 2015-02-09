var request = require('request');
var async = require('async');

var fs = require('fs');
var path = require('path');
var countries = require('countries-info');
var config = require('../../config.json');

var redisMng = require('./redis');

function createPIN(redisKeyId, phone, cbk){
    var redisKey = config.redisKeys.user_phone_verify.key;
    redisKey =  redisKey.replace('{userId}',redisKeyId).replace('{phone}',phone);
    var expires = config.redisKeys.user_phone_verify.expireInSec;
    var pinAttempts = config.userPIN.attempts;

    var pin = '';
    for(var i=0; i<config.userPIN.size; i++){
        var randomNum = Math.floor(Math.random() * 9);
        pin += randomNum.toString();
    }

    redisMng.insertKeyValue(redisKey + '.pin', pin, expires, function(err, pin){
        if(err){
            return cbk(err);
        }
        redisMng.insertKeyValue(redisKey + '.attempts', pinAttempts , expires, function(err, attemps){
            if(err) {
                return cbk(err);
            }
            sendPIN(phone, pin, function(err){
                cbk(err, pin);
            });
        });
    });
}

function sendPIN(phone, pin, cbk){
    var notifServiceURL = config.services.notifications;
    var sms = {
        phone: phone,
        text: 'MyContacts pin code: ' + pin
    };

    var options = {
        url: notifServiceURL + '/notification/sms',
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        },
        method: 'POST',
        body: JSON.stringify(sms)
    };

    request(options, function(err,res,body) {
        if(err){
            return cbk(err);
        }
        cbk();
    });
}

function verifyPhone(redisKeyId, phone, pin, cbk) {
    if( !config.usePinVerification ) {
        return cbk(null, true);
    }

    if (!phone) {
        return cbk({
            err: 'auth_proxy_error',
            des: 'empty phone',
            code: 400
        });
    }

    if (!pin) {
        createPIN(redisKeyId, phone, function (err, createdPin) {
            if (err) {
                err.code = 500;
                return cbk(err);
            } else {
                return cbk({
                    err: 'auth_proxy_error',
                    des: 'User phone not verified',
                    code: 403
                });
            }
        });
    } else {
        var redisKey = config.redisKeys.user_phone_verify.key;
        redisKey = redisKey.replace('{userId}',redisKeyId).replace('{phone}',phone);

        redisMng.getKeyValue(redisKey + '.pin', function(err, redisPhonePin){
            if(err) return cbk(err);

            if(!redisPhonePin) {
                createPIN(redisKeyId, phone, function(err, createdPin){
                    if(err) {
                        return cbk(err);
                    }
                    return cbk({
                        err:'verify_phone_error',
                        des:'Expired PIN or incorrect phone number.',
                        code: 401
                    }, false);
                });
            } else {
                redisMng.getKeyValue(redisKey + '.attempts', function(err, redisPinAttempts) {
                    if(err) return cbk(err);
                    if(!redisPinAttempts || redisPinAttempts === '0') {
                        createPIN(redisKeyId, phone, function(err, createdPin){
                            if(err){
                                return cbk(err);
                            }
                            return cbk({
                                err:'verify_phone_error',
                                des:'PIN used has expired.',
                                code: 401
                            }, false);
                        });
                    } else {
                        if(pin === redisPhonePin){
                            return cbk(null, true);
                        } else {
                            //Last attempt
                            if(redisPinAttempts === '1'){
                                createPIN(redisKeyId, phone, function(err, createdPin){
                                    if(err) {
                                        return cbk(err);
                                    }
                                    return cbk({
                                        err:'verify_phone_error',
                                        des:'PIN used has expired.',
                                        code: 401
                                    }, false);
                                });
                            } else {
                                redisMng.updateKeyValue(redisKey + '.attempts', redisPinAttempts-1, function (err, attempts) {
                                    if (err) return cbk(err);
                                    return cbk({
                                        err: 'verify_phone_error',
                                        des:'PIN used is not valid.',
                                        code: 401
                                    }, false);
                                });
                            }
                        }
                    }
                });
            }
        });
    }
}

module.exports = {
    createPIN : createPIN,
    verifyPhone : verifyPhone
};