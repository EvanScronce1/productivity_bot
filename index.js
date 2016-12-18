'use strict';

require('./fbConnections.js')();
require('./sheets.js')();
require('./calendar.js')();

const uuidV1 = require('uuid/v1');
var request = require('request');


const Hapi = require('hapi');
const server = new Hapi.Server();
var apiai = require('apiai');
var LRU = require("lru-cache");
var bot_interface = apiai("daacc2588ae0499aa5e3df658019ffa8");
var mysql = require('mysql');
var chrono = require('chrono-node')
var follow_up_arr = new Object();
var moment = require('moment');

var dbconn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'productivity_bot_db'
});

server.connection({
    host: '0.0.0.0',
    port: 8888
});

var options = {
    max: 5000,
    length: function(n, key) {
        return n * 2 + key.length
    },
    dispose: function(key, n) {
        n.close()
    }
};

var cache = LRU(options);

function greetUser(senderID) {
    sendTextMessage("Hi :) \nI am Rosy your workorder assistant. You can start a new workorder by sending\n#workorder", senderID);
}

Date.prototype.addHours = function(h) {
    this.setTime(this.getTime() + (h * 60 * 60 * 1000));
    return this;
}

function handleNlpResponse(action, context, parameter, inputText, senderID) 
{
    if (action == "send_greetings") {
        greetUser(senderID);
    } else if (action == "start_over" && parameter.new_work != "") {
        sendTextMessage("I am all geared up to help you. Please provide your phone number.", senderID);
    } else if (action == "share_details") {
        var cache_entry = cache.get(parameter["phone-number"]);

        //TODO check more enteries
        if (cache_entry != undefined) {
            cache_entry = JSON.parse(cache_entry);

            sendTextMessage("Awesome " + cache_entry[0] + " :)\nPlease share the problem you are facing. ", senderID);

            var record = {
                id: uuidV1(),
                task: '',
                isUrgent: -1,
                userid: cache_entry[0] + "##" + cache_entry[1] + "##" + cache_entry[2],
                status: 0,
                creation_time: new Date(),
                appointment_time: null,
                fb_token: senderID
            };

            var user_record = {
                unique_id: senderID,
                user_id: cache_entry[0] + "##" + cache_entry[1] + "##" + cache_entry[2]
            };
            dbconn.query('INSERT IGNORE INTO user_table SET ?', user_record, function(err, res) {
                if (err)
                    throw err;
                console.log('Last record insert id:', res.insertId);
            });

            dbconn.query('delete FROM workorder where status = 0 AND userid="' + cache_entry[0] + "##" + cache_entry[1] + "##" + cache_entry[2] + '"', function(err, res) {
                if (err)
                    throw err;
                console.log('Last record insert id:', res.insertId);
                dbconn.query('INSERT INTO workorder SET ?', record, function(err, res) {
                    if (err)
                        throw err;
                    console.log('Last record insert id:', res.insertId);
                });
            });
        } else {
            sendTextMessage("Sorry ! These details are not registered with us.", senderID);
        }
    } else 
    {
        var cache_entry = undefined;
        if (context.length != 0)
            cache_entry = cache.get(context[0].parameters["phone-number"]);

        if (cache_entry != undefined) 
        {
            cache_entry = JSON.parse(cache_entry);
            dbconn.query('SELECT * FROM workorder where status = 0 AND userid="' + cache_entry[0] + "##" + cache_entry[1] + "##" + cache_entry[2] + '"', function(err, records) {
                if (err) throw err;

                var current_time = new Date();
                var timeDiff = Math.abs(current_time.getTime() - records[0].creation_time.getTime());
                var diffHours = Math.floor(timeDiff / (1000 * 3600));
                console.log("Here = "+diffHours);
                if (diffHours < 4) // 4 hour check
                {
                    if (records[0].task == "") //Ask for emergency and change state
                    {
                        //Update task
                        sendTextMessage("Is it an emergency? YES or NO", senderID);
                        dbconn.query(
                            'UPDATE workorder SET task = ? Where id = ?', [inputText, records[0].id],
                            function(err, result) {
                                if (err) throw err;

                                console.log('Changed ' + result.changedRows + ' rows');
                            });
                    } else if (inputText.toUpperCase() == "YES" || inputText.toUpperCase() == "NO" && records[0].isUrgent == -1) {
                        //Ask for appointment date
                        dbconn.query(
                            'UPDATE workorder SET isUrgent = ? Where id = ?', [inputText.toUpperCase() == "YES" ? 1 : 0, records[0].id],
                            function(err, result) {
                                if (err) throw err;
                                console.log('Changed ' + result.changedRows + ' rows');
                            });
                        sendTextMessage("Which date you are comfortable with?", senderID);
                    } else if (inputText.toUpperCase().includes("SLOT") == false) {
                        //8am to 8PM timings
                        var returnedData = chrono.parseDate(inputText);

                        var startDate = new Date(returnedData);
                        startDate.setHours(8, 0, 0, 0);

                        var endDate = new Date(returnedData);
                        endDate.setHours(16, 59, 59, 999);

                        listEventsForDate(getCalendarToken(), startDate, endDate, records[0].id, function(returnVal, startDate, id) {
                            var slots_to_show = "";
                            var curr_idx = 0;
                            var curr_idx = 0;
                            var event_date = null;

                            var slots = 0;
                            var suggested_slots = [];
                            for (var slot_idx = 0; slot_idx < 6; slot_idx++) {
                                if (returnVal.length != 0 && curr_idx < returnVal.length)
                                    event_date = Date.parse(returnVal[curr_idx].start.dateTime);
                                var time = slot_idx * 1.5;
                                var slot_time = new Date(startDate);
                                slot_time.setHours(8 + parseInt(time), (time - parseInt(time)) * 60, 0, 0);

                                if (event_date != slot_time.getTime()) {
                                    suggested_slots.push(slot_time);
                                    //Add string
                                    slots++;
                                    var hour = slot_time.getHours() - (slot_time.getHours() >= 12 ? 12 : 0);
                                    var period = slot_time.getHours() >= 12 ? 'PM' : 'AM';
                                    slots_to_show += "\n" + slots + ". " + hour + ':' + (slot_time.getMinutes() > 0 ? slot_time.getMinutes() : "00") + ' ' + period;
                                } else {
                                    curr_idx++;
                                }
                            }
                            if (slots > 0) {
                                dbconn.query(
                                    'UPDATE workorder SET suggested_slots = ? Where id = ?', [JSON.stringify(suggested_slots), id],
                                    function(err, result) {
                                        if (err) throw err;

                                        console.log('Changed ' + result.changedRows + ' rows');
                                    });
                                sendTextMessage("Date:" + startDate.toLocaleDateString() + "\nChoose a slot:\n" + slots_to_show + "\n\nReply with SLOT <slot number>", senderID);
                            } else
                                sendTextMessage("Sorry :( No slots available for the selected date!\n\nPlease choose another day!", senderID);

                        });
                    } else {
                        //Parse Slot ID and set appointment
                        var suggested_slots = JSON.parse(records[0].suggested_slots);
                        var tokens = inputText.split(" ");
                        var slot_index = parseInt(tokens[1]) - 1;
                        var start_date1 = new Date(suggested_slots[slot_index]);
                        var end_date1 = new Date(suggested_slots[slot_index]);
                        end_date1 = end_date1.addHours(1.5);

                        var message = "Work order details:\n\nID : " + records[0].id + "Issue :" + records[0].task + "\nReporting Time : " + start_date1 + "\nEmergency : " + records[0].isUrgent ? "YES" : "NO" + "\n";

                        setCalendarEntry(getCalendarToken(), records[0].userid.split("##")[1], start_date1, end_date1, records[0].id, message, records[0].task, function(returnVal) {
                            if (returnVal == null) {
                                sendTextMessage("Sorry :( We are unable to process your request. Please try later.", senderID);
                            } else {
                                sendTextMessage("Awesome! Your work request has been registered with us. You will receieve and email shortly.", senderID);

                                dbconn.query(
                                    'UPDATE workorder SET appointment_time = ?,suggested_slots="",status = 1 Where id = ?', [moment(start_date1).format('YYYY-MM-DD HH:mm:ss'), records[0].id],
                                    function(err, result) {
                                        if (err) throw err;
                                        console.log('Changed ' + result.changedRows + ' rows');
                                    });
                            }
                        });

                    }
                } else {
                    dbconn.query('delete FROM workorder1 where status = 0 AND userid="' + cache_entry[0] + "##" + cache_entry[1] + "##" + cache_entry[2] + '"', function(err, res) {
                        if (err)
                            throw err;
                        console.log('Last record insert id:', res.insertId);
                        sendTextMessage("Session expired!\nTry #workorder", senderID);
                    });
                }
            });
        } else {
            dbconn.query('SELECT * FROM user_table where unique_id = "' + senderID + '"', function(err, records) {
                if (err) throw err;
                if (follow_up_arr[records[0].user_id] != undefined && (inputText.toUpperCase().includes("YES") == true || inputText.toUpperCase().includes("NO") == true)) {
                    if (inputText.toUpperCase().includes("YES") == true) {
                        dbconn.query(
                            'UPDATE workorder SET  status = 2 Where id = ?', [follow_up_arr[records[0].user_id]],
                            function(err, result) {
                                if (err) throw err;
                                console.log('Changed ' + result.changedRows + ' rows');
                                sendTextMessage("I am glad. I was able to help you. Let me know if I can help further by sending #workorder", senderID);
                                delete follow_up_arr[records[0].user_id];
                            });
                    } 
                    else 
                    {
                        var curr_date = moment().format('YYYY-MM-DD HH:mm:ss');
                         dbconn.query(
                            'UPDATE workorder SET  status = 0,appointment_time=NULL,creation_time="'+curr_date+'" Where id = ?', [follow_up_arr[records[0].user_id]],
                            function(err, result) {
                                if (err) throw err;
                                var tokens = records[0].user_id.split("##");
                                sendPlainTextMessages("#workorder",senderID);
                                sendPlainTextMessages(tokens[2],senderID);
                                sendTextMessage("Oh! Let me reschedule it for you. Which date are you comforatble with?", senderID);
                                delete follow_up_arr[records[0].user_id];
                            });
                    }
                } else {
                    sendTextMessage("EWWWWWW. I will be honest but at last I am a mere bot. Try #workorder", senderID);
                }
            });

        }
    }
}

function clearContext(senderID) {
    var options = {
    url: 'https://api.api.ai/v1/contexts?sessionId='+senderID,
    headers: {
            'Authorization': 'Bearer daacc2588ae0499aa5e3df658019ffa8',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
    };

    function callback(error, response, body) {
        if (!error && response.statusCode == 200) 
        {

        }
    }

    request.delete(options, callback);
}


function processTextAndRespond(inputText, senderID) {
    var request = bot_interface.textRequest(inputText, {
        sessionId: senderID
    });

    request.on('response', function(response) {
        console.log(response.result.action);
        //console.log(response.result.contexts);
        //console.log(response.result.parameters);

        handleNlpResponse(response.result.action, response.result.contexts, response.result.parameters, inputText, senderID);
    });

    request.on('error', function(error) {
        console.log(error);
    });

    request.end();
}

function sendPlainTextMessages(inputText,senderID)
{
    var request = bot_interface.textRequest(inputText, {
        sessionId: senderID
    });

    request.on('response', function(response) {
        console.log(response.result.action);
    });

    request.on('error', function(error) {
        console.log(error);
    });

    request.end();
}

server.route({
    method: 'GET',
    path: '/webhook/',
    handler: function(request, reply) {
        console.log(request.query);
        if (request.query['hub.verify_token'] === 'research_is_great') {
            reply(request.query['hub.challenge']);
        } else {
            reply('Error, wrong validation token');
        }
    }
});

server.route({
    method: 'GET',
    path: '/refresh_users/',
    handler: function(request, reply) {
        accessAllowedUsers(cache);
    }
});

server.route({
    method: 'GET',
    path: '/close_tasks/',
    handler: function(request, reply) {
        waitThread(false);
    }
});

server.route({
    method: 'POST',
    path: '/webhook/',
    handler: function(request, reply) {
        var messaging_events = request.payload.entry[0].messaging;
        for (var i = 0; i < messaging_events.length; i++) {
            var event = request.payload.entry[0].messaging[i];
            var sender = event.sender.id;
            if (event.message && event.message.text) {
                processTextAndRespond(event.message.text, sender);
            } else if (event.message && event.message.attachments) //A file
            {
                sendTextMessage("File?? Sorry but I am only an Information System", sender);
            } else if (event.postback) {
                var tokens = event.postback.payload.split("###");
            }
        }
        reply("");
    }
});

server.start((err) => {
    if (err) {
        throw err;
    }
    console.log('Server running at:', server.info.uri);
    dbconn.connect(function(err) {
        if (err) {
            console.log('Database connection error');
        } else {
            console.log('Database connection successful');
            accessAllowedUsers(cache);
            initalizeCalendar();
            waitThread(true);
        }
    });
});

function waitThread(start_thread) {

    dbconn.query('SELECT * FROM workorder where status = 1 AND appointment_time < "' + moment().format('YYYY-MM-DD HH:mm:ss') + '"', function(err, records) {
        if (err) throw err;
        for (var i = 0; i < records.length; i++) {
            if (follow_up_arr[records[i].userid] == undefined) {
                follow_up_arr[records[i].userid] = records[i].id;
                sendTextMessage("Your workorder '" + records[i].task + "' was scheduled for " + records[i].appointment_time + ". Is it completed now? YES/NO", records[i].fb_token);
                clearContext(records[i].fb_token);
            }
        }
    });
    if (start_thread)
        setTimeout(waitThread, 86400000);
}
