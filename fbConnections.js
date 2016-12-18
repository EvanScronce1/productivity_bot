var access_token = 'EAAC1wikPHPABALlqqsLZBlKWMtkLZAGzlAreD3AIR4i0IYZA22NATGWnYkAMHFIyR8WZAH1Tqkx9ScbgJOozDuhtLrL4ZAWjeLKgeFt4czo0vZAC5weKNgQRBqxpwkA97tXSK6VvZC5x6QbZBl5Gu2VEldRRfXSZArmTQEdLRFmRBGQZDZD'
var request = require('request');
var user_profile_url = 'https://graph.facebook.com/v2.6/';

module.exports = function() 
{
	this.populateCards = function(asset_obj)
	{
		var cards = [];
		for(var i=0;i<asset_obj.length;i++)
		{						
			if(asset_obj[i].assets[0] == null)
			{
				continue;
			}
			var buttons = [];
			if(typeof(asset_obj[i].tags) == 'undefined')
			{
				buttons.push({
					"type": "postback",
					"title": "Add Tag",
					"payload": "1###"+asset_obj[i].assets_id
				});
			}
			
			buttons.push({
				"type": "postback",
				"title": "Delete",
				"payload": "2###"+asset_obj[i].assets_id
			});
			
			buttons.push({
				"type": "postback",
				"title": "Send via Email",
				"payload": "5###"+asset_obj[i].assets_id
			});
			
			cards.push(getCard(asset_obj[i].tags,"",asset_obj[i].assets[0].url,buttons));
		}
		return cards;
	}
	
	this.createUploadDoneCard = function(subtitle,asset_obj,imagesArr)
	{
		var cards = getCard("",subtitle,imagesArr[0].url,[{
			"type": "postback",
			"title": "Delete",
			"payload": "2###"+asset_obj
		}, {
			"type": "postback",
			"title": "Add Tag",
			"payload": "1###"+asset_obj
		}]);

		return cards;
	}
	
	this.deleteConfirmationCard = function(asset_obj,title)
	{
		var cards = getCard(title,"Want to delete this/these files?","",[{
			"type": "postback",
			"title": "YES",
			"payload": "4###"+asset_obj
		}, {
			"type": "postback",
			"title": "NO",
			"payload": "3###"+asset_obj
		}]);

		return cards;
	}
	
	this.restartTaggingConfirmationCard = function(asset_obj)
	{
		var cards = getCard("Tag Image","Anand! Last we talked, We were tagging some images. Do you want to continue?","",[{
			"type": "postback",
			"title": "YES",
			"payload": "6###"+asset_obj
		}, {
			"type": "postback",
			"title": "NO",
			"payload": "7###"+asset_obj
		}]);

		return cards;
	}
	
	this.getCard = function(title, subtitle, img_url,buttons) {
		var card =    {
			"title": title,
			"subtitle": subtitle,
			"image_url": img_url,
			"buttons":buttons
		};


		if(title == "" || typeof(card.title) == 'undefined')
		{
			card.title = "Untagged File";
		}

		if(subtitle == "" || subtitle == null)
		{
			delete card.subtitle;
		}

		if(img_url == "" || img_url == null)
		{
			delete card.image_url;
		}

		if(buttons == "" || buttons == null)
		{
			delete card.buttons;
		}
		return card;
	}
	this.sendImageToFB = function(url, sender) {
		var messageData = {
			"attachment": {
				"type": "image",
				"payload": {
					"render_as_sticker": true,
					"url": url
				}
			}
		};
		sendMessage(sender, messageData);
	};

	this.sendTextMessage = function(text, sender) 
	{
		if(text.length < 320)
		{
			var messageData = {
				text:text
			};
			sendMessage(sender, messageData);
		}
		else
		{
			var words = text.split(" ");
			var splitIndex = [];
			var cntr = 320;
			var data_to_send = "";
			for(var k = 0 ; k < words.length ; k++)
			{
				if(cntr > words[k].length)
				{
					data_to_send+=words[k]+" ";
					cntr = cntr - words[k].length - 1;
				}
				else
				{
					var messageData = {
						text:data_to_send
					};
					sendMessage(sender, messageData);
					data_to_send = "";
					cntr = 320;
					k--;
				}
			}
			var messageData = {
				text:data_to_send
			};
			sendMessage(sender, messageData);
		}
	};
	
	this.sendGenericMessage= function (sender, cards) {
		var messageData = {
			"attachment": {
				"type": "template",
				"payload": {
					"template_type": "generic",
					"elements": cards
				}
			}
		};

		sendMessage(sender, messageData);
	}

	this.sendMessage = function(sender, messageData) {
		var json_data = {
			recipient: {id:sender},
			message: messageData,
		};

		var qs = {access_token:access_token};

		var url = 'https://graph.facebook.com/v2.6/me/messages';
		httpPostRequest(url, qs, json_data);
	};

	this.httpGetRequest = function(url_, qs_, callback) {
		var options;
		if(qs_ == undefined) options = {url: url_, method: 'GET'};
		else options = {url: url_, qs: qs_, method: 'GET'};

		request(options, function(error, response, body) {
			if (error) {
				console.log('Error sending message: ', error);
			} else if (response.body.error) {
				console.log('Error: ', response.body.error);
			} else {
				callback(body);
			}
		});
	};
	this.httpPostRequest = function(url_, qs_, json_, callback) {
		var options = {
			url: url_,
			qs: qs_,
			method: 'POST',
			json: json_};

			request(options, function(error, response, body) {
				if (error) {
					console.log('Error sending message: ', error);
				} else if (response.body.error) {
					console.log('Error: ', response.body.error);
				} else {
					if(callback != undefined)
						callback(body);
				}
			});
		};

		this.getUserInfo = function(user_id,callback)
		{
			var request = require("request");
			var apiUrl = user_profile_url+user_id+"?fields=first_name,last_name&access_token="+access_token;
			request(apiUrl, function(error, response, body) 
			{
				callback(body);
			});
		};
	}