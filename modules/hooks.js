var moment = require('moment-timezone');
var config = require('../config.js');

var cm = config.mongodb;

var hooks = {};

hooks.log = function(db, data) {
    var log = db.collection(cm.collections.logs);
    data.datetime = moment().utc().format();
    log.insert(data);
    console.log("[" + data.datetime + "] " + data.info);
};

hooks.addMessage = function(db, data) {
    var messages = db.collection(cm.collections.messages);
    data.datetime = moment().utc().format();
    messages.insert(data);
};

hooks.getMessages = function(db, data, callback) {
    var messages = db.collection(cm.collections.messages);
    var channel = data.channel;
    var messages = db.collection(cm.collections.messages);
    var limit = 50;

    var query = {
        channel: channel
    };

    if(data.user) {
        query.username = data.user.toLowerCase();
    }

    if(data.limit) {
        limit = (parseInt(data.limit) || limit);
    }

    messages.find(query).sort({$natural: -1}).limit(limit).toArray(function(err, values) {
        if(err) {
            hooks.log(db, {
                info: err
            });
            return;
        }
        var msgs = [];
        values.forEach(function(message) {
            delete message._id;
            delete message.user;
            msgs.push(message);
        });
        callback({
            count: msgs.length,
            messages: msgs
        });
    });
};

hooks.updateAllChannels = function(db, data) {
    var channels = db.collection(cm.collections.channels);
    var channel_ids = Object.keys(data);
    channels.deleteMany({}, null, function(error, result) {
        if(error) {
            hooks.log(db, {
                info: error
            });
            return;
        }

        hooks.log(db, {
            info: "Cleared channel collection for update"
        });

        channel_ids.forEach(function(id) {
            var channel = data[id];
            channel.id = id;
            channels.insert(channel);
            hooks.log(db, {
                info: "Updated channel collection with: " + channel.name + " (" + channel.id + ")"
            });
        });
    });
};

hooks.addChannel = function(db, data) {
    var channels = db.collection(cm.collections.channels);
    if(data.id) {
        channels.insert(data);
        hooks.log(db, {
            info: "Discord channel added: " + data.name + " (" + data.id + ")"
        });
    }
};

hooks.getChannels = function(db, callback) {
    var channels = db.collection(cm.collections.channels);
    channels.find().toArray(function(err, allChannels) {
        if(err) {
            hooks.log(db, {
                info: err
            });
            return;
        }

        var all = {};
        allChannels.forEach(function(channel) {
            all[channel.id] = {
                server: channel.server,
                name: channel.name
            };
        });

        callback(all);
    });
};

hooks.isUser = function(user, callback) {
    if(user && config.users.indexOf(user.toLowerCase()) > -1) {
        callback(true);
    } else {
        callback(false);
    }
}

module.exports = hooks;
