var config = {};

// https://discordapp.com/developers/applications/me
config.discord = {
    client_id: '', // Bot client ID / application ID
    token: '', // Bot token
    admins: [''], // User IDs of users that are allowed to use commands
    servers: [''] // IDs of servers to log, leave empty for all of them
};

// MongoDB database information
config.mongodb = {
    host: "127.0.0.1",
    port: "27017",
    username: "discordlog",
    password: "123",
    database: "discordlog",
    collections: {
        logs: "logs",
        messages: "messages"
    }
};

// Twitch application information
config.twitch = {
    clientID: "",
    clientSecret: "",
    callbackURL: "http://localhost:8888/auth/twitch/callback",
    scope: ""
};

// Twitch usernames allowed to view logs - keep them lowercase
config.users = [];

// Configuration for web interface
config.express = {
    enabled: false,
    port: 8888
};

module.exports = config;
