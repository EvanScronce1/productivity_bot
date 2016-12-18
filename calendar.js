var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

var SCOPES = ['https://www.googleapis.com/auth/calendar'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';
var authToken;
// Load client secrets from a local file.
module.exports = function() {
    this.listEventsForDate = function(auth, startDate, endDate, id, callback) {
        var calendar = google.calendar('v3');
        calendar.events.list({
            auth: auth,
            calendarId: 'primary',
            timeMin: (startDate).toISOString(),
            timeMax: (endDate).toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        }, function(err, response) {
            if (err) {
                console.log('The API returned an error: ' + err);
                callback(null, startDate, id);
            }
            var events = response.items;
            callback(events, startDate, id);
        });
    }

    this.initalizeCalendar = function() {
        fs.readFile('client_secret_cal.json', function processClientSecrets(err, content) {

            if (err) {
                console.log('Error loading client secret file: ' + err);
                return;
            }

            authorize(JSON.parse(content) /*, listEvents*/ );
        });
    }

    this.getCalendarToken = function() {
        return authToken;
    }

    this.setCalendarEntry = function(auth, email, startDate, endDate, id, message, subject, callback) {
        var event = {
            'summary': subject,
            //'location': '800 Howard St., San Francisco, CA 94103',
            'description': message,
            'start': {
                'dateTime': startDate,
            },
            'end': {
                'dateTime': endDate,
            },
            'attendees': [{
                'email': email
            }, ],
        };

        var calendar = google.calendar('v3');
        calendar.events.insert({
            auth: auth,
            sendNotifications: true,
            calendarId: 'primary',
            resource: event,
        }, function(err, event) {
            if (err) {
                console.log('There was an error contacting the Calendar service: ' + err);
                callback(null);
                return;
            }
            callback(event.htmlLink);
        });
    }
}

function authorize(credentials /*, callback*/ ) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function(err, token) {
        if (err) {
            getNewToken(oauth2Client /*, callback*/ );
        } else {
            oauth2Client.credentials = JSON.parse(token);
            //callback(oauth2Client);
            authToken = oauth2Client;
        }
    });
}

function getNewToken(oauth2Client /*, callback*/ ) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            authToken = oauth2Client;
        });
    });
}

function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}