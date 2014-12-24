var debug = require('debug')('cipherlayer:service');
var userDao = require('../dao');

function findUser (req, res, next){
    userDao.getFromId(req.tokenInfo.userId, function(err, foundUser){
        if (err){
            debug('invalid_access_token', req.accessToken, 'contains unknown user', req.tokenInfo.userId);
            res.send(401, {err:'invalid_access_token', des:'unknown user inside token'});
            return next(false);
        } else {
            req.user = foundUser;
            next();
        }
    });
}

module.exports = findUser;
