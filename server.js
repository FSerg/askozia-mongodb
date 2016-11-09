var mongoose = require('mongoose/');
var utils = require('./utils');
var moment = require('moment');
var fs = require("fs");
var request = require('request');
var audioConverter = require("audio-converter");
if (process.env.NODE_ENV === 'production') { var config = require('./config'); }
else { var config = require('./config-dev'); }

// MONGODB
var itemSchema = new mongoose.Schema({_id: String}, { strict: false });
var Item = mongoose.model('Item', itemSchema);

var userSchema = new mongoose.Schema({_id: String}, { strict: false });
var User = mongoose.model('User', userSchema);

mongoose.connect(config.MONGO_URL, function(err) {
    // console.log('Connection string: '+config.MONGO_URL); // for debugging only
    if (err) {
        console.log(err);
    } else {
        console.log('Connected to MongoDB! ('+moment().format()+')');
    }
});


// ASKOZIA
var ami = new require('asterisk-manager')(config.agi_port, config.agi_host, config.agi_login, config.agi_pass, true);
ami.keepConnected();

ami.on('disconnect', function(evt) {
    console.log('ATS askozia disconnected ('+moment().format()+'):');
    console.log(evt);
});

ami.on('connect', function(evt) {
    console.log('==========================================================');
    console.log('ATS askozia connected! ('+moment().format()+')');
});

// catch CDR event and send metrics to InfluxDB
ami.on('cdr', function(evt) {
    // console.log("==========================================================");
    console.log('CDR event! '+'('+moment().format()+')');
    // console.log("==========================================================");
    // console.log(evt);
    // console.log("==========================================================");

    var data = utils.prepareData(evt);
    // console.log(data);
    // console.log("==========================================================");

    var new_item = new Item(data);
    new_item.save(function(err) {
        if (err) {
            console.log('Error save Item (cdr event) in database ('+moment().format()+'):');
            console.log(err);
        }
        else {
            console.log('Call added! ('+moment().format()+')');
        }
    }); // end save to MongoDB

});

ami.connect(function(){
    console.log('Try connecting to ATS ('+moment().format()+')');
});


// TELEGRAM
var TelegramBot = require('node-telegram-bot-api');
var bot = new TelegramBot(config.BOT_TOKEN, {polling: true});

// Matches /echo [whatever]
bot.onText(/\/start (.+)/, function(msg, match) {
    var MeteorUserID = match[1];
    var TelegramUserID = msg.from.id;

    // try find user and save TelegramUserID
    var newData = {"profile": {"telegram": TelegramUserID.toString()}};
    User.findOneAndUpdate({_id: MeteorUserID}, newData, {upsert:false}, function(err, doc){
        //console.log(doc);
        if (err) {
            console.log(err);
            bot.sendMessage(TelegramUserID, "Ошибка доступа к базе данных пользователей!");
        }
        else {
            if (doc) {
                bot.sendMessage(TelegramUserID, "Ваш ID зарегистрирован для доступа к записям!");
            }
            else {
                bot.sendMessage(TelegramUserID, "К сожалению, не смогли вас идентифицировать!");
            }
        }

    });

});

// GET, CONVERT AND STORE FILES
var express = require('express');
var app = express();
app.use("/records", express.static(__dirname + '/records'));

app.get('/record', function(req, res) {
    var recordId = req.query.recordId;
    var recordingfile = req.query.recordingfile;


    try {
        fs.mkdirSync('records/' + recordId);
    } catch (e) {
        // if ( e.code != 'EEXIST' ) throw e;
        console.log('Error create directory for record! ('+moment().format()+')');
        console.error(e);
        return res.status(500).send({result: 'Error create directory for record!'});
    }

    var fileName = './records/'+recordId+'/'+recordId+'.wav';
    var folderName = './records/'+recordId;

    console.log(fileName);

    // try get record file from askozia
    var adress = "/cfe/wallboard/1c/download.php?type=Records&view=";
    var url   = "http://"+config.agi_host + adress + recordingfile;

    request.get(url, {
        'auth': {
            'user': config.askozia_login,
            'pass': config.askozia_pass
        }
    })
    .on('error', function(err) {
        console.log('Error get file from askozia! ('+moment().format()+')');
        console.error(err);
        return res.status(500).send({result: "Error get file from askozia"});
    })
    .on('response', function(response) {
        fileSize = response.headers['content-length'];
        if (fileSize) {
            console.log('File saved! ('+moment().format()+')');
            console.log('Start converting ...');

            audioConverter(folderName, folderName, {
                //progressBar: true,
                //verbose: true,
                //mp3Only: true,
                //mp3Quality:128,
                //oggOnly: true,
                chunkSize: 1
            }).then(function() {
                console.log('Audio file was converted! ('+moment().format()+')');
                return res.send({result: 'ok'});

            }, function(converr) {
                console.log('Error converting! ('+moment().format()+')');
                console.error(converr);
                return res.status(404).send({result: "Error converting!"});
            });

        } else {
            console.log('File is empty! ('+moment().format()+')');
            fs.unlinkSync(fileName);
            fs.rmdirSync(folderName); // and don't forget delete empty temp dir
            return res.status(404).send({result: "File is empty!"});
        }
    })
    .pipe(fs.createWriteStream(fileName)); // save file from askozia to disk
    // res.send({result:'ok'});
});


// SEND RECORD TO TELEGRAM
app.get('/sendrecord', function(req, res) {
    var recordId = req.query.recordId;
    var chatId = req.query.chatId;
    var caption = req.query.caption;
    var recordFile = './records/'+recordId+'/'+recordId+'.mp3';

    var optData = {
        title: recordId,
        caption: caption
    };
    // console.log('Получен запрос отправки файла!');
    // console.log('recordId: '+recordId);
    // console.log('chatId: '+chatId);

    bot.sendAudio(chatId, recordFile, optData)
        .then(function(resp) {
            console.log('Record was successfully sent! ('+moment().format()+')');
            return res.send({result: 'ok'});
        })
        .catch(function(err) {
            console.log('Error while sent record file: '+recordId+'! ('+moment().format()+')');
            console.log(err);
            return res.status(500).send({result: "Error sent file to Telegram"});
        });

});

app.listen(config.store_port, function () {
  console.log('Records store started at '+config.store_port+' port! ('+moment().format()+')');
});
