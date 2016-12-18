var ngrok = require('ngrok');
ngrok.connect(8888, function (err, url) 
{
	console.log(err,"NGROK : "+url);
});