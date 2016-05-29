var config = {};

// https://discordapp.com/developers/applications/me
config.discord = {
    client_id: '', // Bot client ID / application ID
    token: '', // Bot token
    admins: [''], // User IDs of users that are allowed to use commands
    servers: [''] // IDs of servers to log, leave empty for all of them
};

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

module.exports = config;
