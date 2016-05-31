var discord = require('discord.js');
var express = require('express');
var swig = require('swig');
var passport = require('passport');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var cookieSession = require('cookie-session');
var mongo = require('mongodb').MongoClient;
var twitchPassport = require('passport-twitch');
var twitchStrategy = twitchPassport.Strategy;

var config = require('./config.js');

var admins = config.discord.admins;
var servers = config.discord.servers;

var cm = config.mongodb;
var mongoUrl = "mongodb://" + cm.username + ":" + cm.password + "@" + cm.host + ":" + cm.port + "/" + cm.database;
var bot = new discord.Client();

var commands = require('./modules/commands.js');
var hooks = require('./modules/hooks.js');
var web = express();

mongo.connect(mongoUrl, function(err, db) {
    if(err) {
        console.log(err);
        return;
    }

    bot.on("ready", function() {
        hooks.log(db, {
            info: "Bot initialized"
        });

        var channels = {};
        hooks.getChannels(db, function(allChannels) {
            channels = allChannels;
            bot.channels.forEach(function(channel) {
                if(channel.type === "text") {
                    var server_id = channel.server.id;
                    var server_name = channel.server.name;
                    var channel_id = channel.id;
                    var channel_name = channel.name;
                    if(!channels[channel_id]) {
                        channels[channel_id] = {
                            server: {
                                id: server_id,
                                name: server_name
                            },
                            name: channel_name
                        };
                    } else {
                        if(channels[channel_id].name !== channel_name) {
                            channels[channel_id].name = channel_name;
                        }
                    }
                }
            });
            hooks.updateAllChannels(db, channels);
        });
    });

    bot.on("message", function(message) {
        if(message.channel && message.channel.server && servers.indexOf(message.channel.server.id) > -1) {
            var msg = message.content;
            var user = message.author; // .username + .id
            var channel = message.channel; // .name + .id
            var server = message.channel.server;
            var ts = message.timestamp;
            if(message.mentions && message.mentions.length > 0) {
                message.mentions.forEach(function(user) {
                    msg = msg.replace(user.id, user.username + " [" + user.id + "]");
                });
            }

            var msgData = {
                message: msg,
                server: {
                    id: server.id,
                    name: server.name
                },
                user: {
                    name: user.username,
                    discriminator: user.discriminator,
                    id: user.id
                },
                channel: {
                    name: channel.name,
                    id: channel.id
                },
                timestamp: ts,
                edited: false
            };

            hooks.addMessage(db, msgData);
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
            var server = after.channel.server;
            var ts = after.timestamp;
            if(after.mentions && after.mentions.length > 0) {
                after.mentions.forEach(function(user) {
                    msg = msg.replace(user.id, user.username + " [" + user.id + "]");
                });
            }

            var msgData = {
                message: msg,
                server: {
                    id: server.id,
                    name: server.name
                },
                user: {
                    name: user.username,
                    discriminator: user.discriminator,
                    id: user.id
                },
                channel: {
                    name: channel.name,
                    id: channel.id
                },
                timestamp: ts,
                edited: true
            };

            hooks.addMessage(db, msgData);
        }
    });

    bot.on("channelCreated", function(channel) {
        if(channel.server && channel.type === "text") {
            hooks.addChannel(db, {
                server: {
                    id: channel.server.id,
                    name: channel.server.name
                },
                name: channel.name,
                id: channel.id
            });
        }
    });

    bot.loginWithToken(config.discord.token);

    var helpers = {
        render: function(req, res, page, data) {
            if(!data) {
                data = {};
            }

            if(req.session && req.session.passport && req.session.passport.user) {
                data.user = req.session.passport.user;
            }

            data.page = page;
            res.render(page.toLowerCase(), data);
        },
        json: function(req, res, data, code) {
            if(!code) {
                code = 200;
            }

            res.status(code).json(data);
        }
    };

    if(config.express.enabled) {
        var webport = (config.express.port || 8888);

        web.engine('html', swig.renderFile);
        web.set('view engine', 'html');
        web.set('views', __dirname + '/resources/views');

        web.use('/static', express.static(__dirname + '/resources/static'));
        web.use(bodyParser.urlencoded({ extended: true }));
        web.use(cookieParser());
        web.use(cookieSession({secret: config.twitch.clientSecret}));
        web.use(passport.initialize());
        web.use(passport.session());

        var router = express.Router();
        router.use(function(req, res, next) {
            if(!req.session || !req.session.passport || !req.session.passport.user) {
                res.redirect("/");
                return;
            }
            next();
        });

        passport.use(new twitchStrategy(config.twitch,
            function(access_token, refresh_token, profile, done) {
                hooks.isUser(profile.username, function(isUser) {
                    if(!isUser) {
                        return done(null, false);
                    }

                    return done(null, profile);
                });
            }
        ));

        passport.serializeUser(function(profile, done) {
            done(null, profile);
        });

        passport.deserializeUser(function(profile, done) {
            done(null, profile);
        });

        web.get('/', function(req, res) {
            var data = {};
            if(req.query.message) {
                data.message = req.query.message;
            }

            hooks.getChannels(db, function(channels) {
                data.channels = channels;
                helpers.render(req, res, "Home", data);
            });
        });

        web.get("/auth/twitch", passport.authenticate("twitch"));
        web.get("/auth/twitch/callback", passport.authenticate("twitch", { failureRedirect: "/?message=Unauthorized" }), function(req, res) {
            res.redirect("/");
        });

        web.get("/auth/logout", function(req, res) {
            req.logout();
            res.redirect("/");
        });

        router.get('/messages', function(req, res) {
            var channel = req.get('channel');
            var user_id = (req.get('user_id') || null);
            var limit = (parseInt(req.get('limit')) || 50);

            if(channel) {
                hooks.getMessages(db, {
                    channel: channel,
                    user_id: user_id,
                    limit: limit
                },
                function(data) {
                    helpers.json(req, res, data);
                });
            } else {
                helpers.json(req, res, {
                    status: 403,
                    error: "Missing channel name"
                }, 403);
            }
        });

        router.get('/channels', function(req, res) {
            hooks.getChannels(db, function(channels) {
                helpers.json(req, res, channels);
            });
        });

        router.get('/', function(req, res) {
            helpers.json(req, res, {
                status: 404,
                error: "404 not found"
            }, 404);
        });

        web.use('/api', router);
        web.get('*', function(req, res) {
            helpers.render(req, res, "404", {});
        });

        web.listen(webport, function() {
            hooks.log(db, {info: "Discord Log's web interface listening on port: " + webport});
        });
    }
});
