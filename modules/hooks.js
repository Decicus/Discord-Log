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
    var limit = 50;

    var query = {
        "channel.id": channel
    };

    if(data.user_id && data.user_id !== "") {
        query["user.id"] = data.user_id;
    }

    if(data.limit) {
        limit = (parseInt(data.limit) || limit);
    }

    messages.find(query).sort({$natural: -1}).limit(limit).toArray(function(err, msgs) {
        if(err) {
            hooks.log(db, {
                info: err
            });
            return;
        }

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

hooks.updateChannel = function(db, data) {
    var channels = db.collection(cm.collections.channels);
    if(data.id) {
        channels.findOneAndUpdate({
            id: data.id
        }, {
            "$set": {
                name: data.name
            }
        });

        hooks.log(db, {
            info: "Discord channel updated: " + data.name + " (" + data.id + ")"
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
};


var regexes = {
    channel: /<#(\d+)>/g,
    nickname: /<@!(\d+)>/g,
    role: /<@&(\d+)>/g
};

hooks.checkIds = function(data, callback) {
    var msg = data.message;
    var channels = msg.match(regexes.channel);
    if(channels) {
        channels.forEach(function(mention) {
            id = mention.match(/\d+/)[0];
            if(id && data.channels[id]) {
                msg = msg.replace(mention, "<#" + data.channels[id].name + ">");
            }
        });
    }

    var nicknames = msg.match(regexes.nickname);
    if(nicknames) {
        nicknames.forEach(function(mention) {
            id = mention.match(/\d+/)[0];
            if(id && data.users[id]) {
                var user = data.users[id];
                msg = msg.replace(mention, "<@" + user.name + "#" + user.discriminator + " [" + id + "]>");
            }
        });
    }

    var roles = msg.match(regexes.role);
    if(roles) {
        roles.forEach(function(mention) {
            id = mention.match(/\d+/)[0];
            if(id && data.roles[data.server][id]) {
                msg = msg.replace(mention, "<@" + data.roles[data.server][id].name + ">");
            }
        });
    }

    callback(msg);
};

module.exports = hooks;
