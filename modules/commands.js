var commands = {};

commands["!quit"] = function(db, bot, author, msg, callback) {
    callback("Discord Log bot is disconnecting...");
    bot.logout();
    db.close();
    process.exit();
};

module.exports = commands;
