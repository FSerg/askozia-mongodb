module.exports = {

    "store_port": process.env.STORE_PORT || 4999,
    "agi_port": process.env.AGI_PORT || "5038",
    "agi_host": process.env.AGI_HOST,
    "agi_login": process.env.AGI_LOGIN || "test",
    "agi_pass": process.env.AGI_PASS || "testTEST",
    "askozia_login": process.env.ASKOZIA_LOGIN || "admin",
    "askozia_pass": process.env.ASKOZIA_PASS,
    "MONGO_URL": process.env.MONGO_URL || "mongodb://localhost:27017/askoziadb",
    "BOT_TOKEN": process.env.BOT_TOKEN

};
