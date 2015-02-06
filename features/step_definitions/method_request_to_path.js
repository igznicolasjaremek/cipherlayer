var world = require('../support/world');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));
var nock = require('nock');
var request = require('request');
var assert = require('assert');

var myStepDefinitionsWrapper = function () {
    this.When(/^the client makes a (.*) request to (.*)$/, function (METHOD, PATH, callback) {

        var path = PATH.replace(":email", world.getUser().username);
        var options = {
            url: 'http://localhost:' + config.public_port + path,
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            method: METHOD
        };
        options.headers[config.version.header] = "test/1";

        nock(config.services.notifications)
            .post('/notification/email')
            .reply(201);

        request(options, function(err,res,body) {
            assert.equal(err,null);
            world.getResponse().statusCode = res.statusCode;
            world.getResponse().body = JSON.parse(body);
            callback();
        });
    });
};
module.exports = myStepDefinitionsWrapper;