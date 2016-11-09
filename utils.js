var moment = require('moment');

function translateValue(value) {
    var dictionary = {
        "ANSWERED" : "Ответили",
        "NO ANSWER" : "Не ответили",
        "BUSY" : "Занято",
        "inbound" : "Входящий",
        "outbound" : "Исходящий"
    };

    if (value in dictionary) {
        return dictionary[value];
    }
    return value;
}


function prepareData(evt) {

    // determine phone number - depend from directions
    var phone = evt.destination;
    var direction = evt.userfield;
    if (direction === 'inbound') {
        phone = evt.callerid;
    }

    // determine durations
    var durationTotal = parseInt(evt.duration);
    var durationTalk = parseInt(evt.billableseconds);
    var durationWait = durationTotal - durationTalk;

    return {
        _id: evt.uniqueid,
        source: evt.source,
        destination: evt.destination,
        callerid: evt.callerid,
        phone: phone,
        disposition: translateValue(evt.disposition),
        uniqueid: evt.uniqueid,
        direction: translateValue(direction),
        recordingfile: evt.recordingfile,

        starttime: moment(evt.starttime),
        answertime: moment(evt.answertime || evt.endtime),
        endtime: moment(evt.endtime),

        duration_total: durationTotal,
        duration_talk: durationTalk,
        duration_wait: durationWait
    };
}
exports.prepareData = prepareData;
