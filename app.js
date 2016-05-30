var mongo = require('mongodb').MongoClient;
var discord = require('discord.js');
var express = require('express');
var moment = require('moment-timezone');
var config = require('./config.js');
var admins = config.discord.admins;
var servers = config.discord.servers;

var cm = config.mongodb;
var mongoUrl = "mongodb://" + cm.username + ":" + cm.password + "@" + cm.host + ":" + cm.port + "/" + cm.database;
var bot = new discord.Client();

var commands = require('./modules/commands.js');

var hooks = {
    log: function(db, data) {
        var log = db.collection(cm.collections.logs);
        data.datetime = moment().utc().format();
        log.insert(data);
        console.log("[" + data.datetime + "] " + data.info);
    },
    addMessage: function(db, data) {
        var messages = db.collection(cm.collections.messages);
        data.datetime = moment().utc().format();
        messages.insert(data);
    }
};

mongo.connect(mongoUrl, function(err, db) {
    if(err) {
        console.log(err);
        return;
    }

    bot.on("ready", function() {
        hooks.log(db, {
            info: "Bot initialized"
        });
    });

    bot.on("message", function(message) {
        if(message.channel && message.channel.server && servers.indexOf(message.channel.server.id) > -1) {
            var msg = message.content;
            var user = message.author; // .username + .id
            var channel = message.channel; // .name + .id
            var ts = message.timestamp;
            if(message.mentions && message.mentions.length > 0) {
                message.mentions.forEach(function(user) {
                    msg = msg.replace(user.id, user.username + " [" + user.id + "]");
                });
            }

            hooks.addMessage(db, {
                server_id: message.channel.server.id,
                server_name: message.channel.server.name,
                message: msg,
                user_name: user.username,
                user_id: user.id,
                channel_name: channel.name,
                channel_id: channel.id,
                timestamp: ts,
                edited: false
            });
        } else {
            if(admins.indexOf(message.author.id) > -1) {
                var msg = message.content;
                var cmd = msg.split(' ')[0];
                var author = message.author;
                if(commands[cmd]) {
                    commands[cmd](db, bot, author, msg, function(result) {
                        bot.sendMessage(author.id, result, { tts: false }, function(error, message) {
                            if(error) {
                                hooks.log(db, {
                                    info: error
                                });
                            }
                        });

                        hooks.log(db, {
                            user_id: author.id,
                            user_name: author.username,
                            info: result
                        });
                    });
                }
            }
        }
    });

    bot.on("messageUpdated", function(before, after){
        if(after.channel && after.channel.server && config.discord.servers.indexOf(after.channel.server.id) > -1) {
            var msg = after.content;
            var user = after.author; // .username + .id
            var channel = after.channel; // .name + .id
            var ts = after.timestamp;
            if(after.mentions && after.mentions.length > 0) {
                after.mentions.forEach(function(user) {
                    msg = msg.replace(user.id, user.username + " [" + user.id + "]");
                });
            }

            hooks.addMessage(db, {
                message: msg,
                user_name: user.username,
                user_id: user.id,
                channel_name: channel.name,
                channel_id: channel.id,
                timestamp: ts,
                edited: true
            });
        }
    });

    bot.loginWithToken(config.discord.token);
});
