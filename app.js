'use strict';

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Dictionary that holds a mapping from user PSID to user name.
var name_dict = {};

// Imports dependencies and set up http server
const 
  request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  app = express().use(body_parser.json()); // creates express http server

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Accepts POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {  

  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {
    body.entry.forEach(function(entry) {

      // Get the webhook event. entry.messaging is an array, but 
      // will only ever contain one event, so we get index 0
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);
      
      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);
      
      getUserInfo(sender_psid, () => {
        if (webhook_event.message) {
          handleMessage(sender_psid, webhook_event.message);
        } else if (webhook_event.postback) {
          handlePostback(sender_psid, webhook_event.postback);
        }
      });
      
    });

    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {
  
  /** UPDATE YOUR VERIFY TOKEN **/
  const VERIFY_TOKEN = "gobears"; // is there a specific way that this is supposed to be generated?
  
  // Parse params from the webhook verification request
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
  
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);      
    }
  }
});


// Handles messages events
function handleMessage(sender_psid, received_message) {
  let response;
  
  console.log(received_message);
  
  // This bugs out the code.
  // if (received_message.nlp) {
  //   let ents = received_message.nlp.entities;
  //   if (ents.greetings) {
  //     if (ents.greetings[0].confidence > 0.8 && ents.greetings[0].value === 'true') {
  //       console.log("Should reply with a greeting!");
  //       callSendAPI(sender_psid, {"text": `Hi to you as well, ${name_dict[sender_psid]}. How can I help you?`});
  //       return;
  //     }
  //   }
  // }
  
  if (received_message.sticker_id && received_message.sticker_id === 369239383222810 || received_message.sticker_id === 369239263222822 || received_message.sticker_id === 369239343222814) {
    response = {
      "text": "I like you too!",
    }
  } else if (received_message.text) {
    console.log('set the text');
    response = {
      "attachment":{
      "type":"template",
      "payload":{
        "template_type":"generic",
        "elements":[

               {
                "title":"Welcome!",
                "image_url":"https://google.com",
                "subtitle":"We have the right hat for everyone.",
                "buttons":[
                  {
                    "type":"web_url",
                    "url":"https://petersfancybrownhats.com",
                    "title":"View Website"
                  }             
            ]
          },
           {
            "title":"Welcome!",
            "image_url":"https://google.com",
            "subtitle":"We have the right hat for everyone.",
            "buttons":[
              {
                "type":"web_url",
                "url":"https://petersfancybrownhats.com",
                "title":"View Website"
              }             
            ]
          }
        ]
      }
      }
    }
  } else if (received_message.attachments) {
    
    response = {
      "text": "That's a cool attachment, but I don't know how to read it yet - sorry!"
    }
  
    // Gets the URL of the message attachment
    let attachment_url = received_message.attachments[0].payload.url;
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Is this the right picture?",
            "subtitle": "Tap a button to answer.",
            "image_url": attachment_url,
            "buttons": [
              {
                "type": "postback",
                "title": "Yes!",
                "payload": "yes",
              },
              {
                "type": "postback",
                "title": "No!",
                "payload": "no",
              }
            ],
          }]
        }
      }
    }
  }
  
  callSendAPI(sender_psid, response);

}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
  let response;
  
  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = { "text": "Thanks!" }
  } else if (payload === 'no') {
    response = { "text": "Oops, try sending another image." }
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  
  console.log('called the send api');
  
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }
  
    // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  });
  
}

function getUserInfo(sender_psid, _callback) {
  if (!(sender_psid in name_dict)) {
    request({
      "uri": `https://graph.facebook.com/v2.6/${sender_psid}?access_token=${PAGE_ACCESS_TOKEN}`,
      "method": "GET"
    }, (err, res, body) => {
      if (!err) {
        var obj = JSON.parse(res.body);
        name_dict[sender_psid] = obj.first_name;
      } else {
        console.error("Unable to get username:" + err);
        name_dict[sender_psid] = "Unknown";
      }
      _callback();
    });
  }
}