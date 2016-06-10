var hooks = require('./hooks.js');
var commands = {};

commands["!quit"] = function(db, bot, author, msg, callback) {
    callback({
        message: "Discord Log bot is disconnecting..."
    });
    bot.off("disconnected");
    bot.logout(function(error) {
        if(error) {
            hooks.log(db, {
                info: error
            });
        }
        db.close(function(error) {
            if(error) {
                console.error(error);
            }
            process.exit();
        });
    });
};

module.exports = commands;
