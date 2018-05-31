'use strict';

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const CONF_THRESH = 0.8;

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
  
  let user_name = name_dict[sender_psid];
  

  if (received_message.nlp) {
    let ents = received_message.nlp.entities;

    if (ents.intent) {
      let val = ents.intent[0].value;
      let conf = ents.intent[0].confidence;
      if (conf > CONF_THRESH) {
        if (val === 'tutorial') {
          callSendAPI(sender_psid, generateTextResponse("You can ask me for details about what services HKN offers, about what apparel we sell, about paying for apparel, or about advertisements that you want sent out to HKN members."));
          response = generateTextResponse("If none of those options work, you can ask me to talk to a human.");
        } else if (val === 'services') {
          callSendAPI(sender_psid, generateTextResponse("Check out all of the services that we have to offer!"));
          response = getHKNServicesResponse();
        } else if (val === 'apparel') {
          response = {
            "attachment":{
              "type":"image", 
              "payload":{
                "is_reusable": true,
                "url": "https://cdn.glitch.com/1315f565-68db-4335-a74f-7caa30cab2a6%2Feecs-merch.png?1527810348797"
              }
            }
          }
          
        } else if (val === 'buy') {
          response = generateTextResponse("buy message");
        } else if (val === 'human') {
          response = generateTextResponse("Okay, let me get a human to answer this for you.");
        }
      }
      console.log(ents.intent);
    } else if (ents.greetings) {
      if (ents.greetings[0].confidence > CONF_THRESH && ents.greetings[0].value === 'true') {
        callSendAPI(sender_psid, {"text": `Hey, ${user_name}. What do you need help with? To find out about what I can do, just ask me.`});
        return;
      }
    }
  } else if (received_message.sticker_id) {
    if (received_message.sticker_id === 369239383222810 || received_message.sticker_id === 369239263222822 || received_message.sticker_id === 369239343222814) {
      response = {
        "text": `I like you too, ${user_name}!`
      }
    } else {
      response = {
        "text": "I wish I could send stickers like that, but Facebook's API won't let me :("
      }
    }
  } else if (received_message.text) {
    response = {"text": "I don't really know what to do now..."};
    
  } else if (received_message.attachments) {
    response = {
      "text": "That's a cool attachment, but I don't know how to read it yet - sorry!"
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
  } else {
    _callback();
  }
}

function getHKNServicesResponse() {
  let response = {
      "attachment":{
        "type":"template",
        "payload":{
          "template_type":"generic",
          "elements":[
             {
              "title":"HKN Tutoring",
              "image_url":"https://hkn.eecs.berkeley.edu/assets/hkn_logo-18c8c978b4a2a023ded5f5bd60133af10734ced26402bc37ed239a9a18e9c017.png",
              "subtitle":"Free drop-in tutoring in Soda and Cory.",
              "buttons":[
                {
                  "type":"web_url",
                  "url":"https://hkn.eecs.berkeley.edu/tutor/",
                  "title":"More details"
                }             
              ]
            },
            {
              "title":"Review Sessions",
              "image_url":"https://hkn.eecs.berkeley.edu/assets/hkn_logo-18c8c978b4a2a023ded5f5bd60133af10734ced26402bc37ed239a9a18e9c017.png",
              "subtitle":"Review Sessions for midterms and finals for CS61ABC, CS70, and EE16AB",
              "buttons":[
                {
                  "type":"web_url",
                  "url":"https://hkn.eecs.berkeley.edu/tutor/calendar",
                  "title":"See Calendar"
                }             
              ]
            },
            {
              "title":"Exam Archive",
              "image_url":"https://hkn.eecs.berkeley.edu/assets/hkn_logo-18c8c978b4a2a023ded5f5bd60133af10734ced26402bc37ed239a9a18e9c017.png",
              "subtitle":"Midterms/finals with solutions from past semesters of most EE/CS classes.",
              "buttons":[
                {
                  "type":"web_url",
                  "url":"https://hkn.eecs.berkeley.edu/exams/",
                  "title":"See Exam Archive"
                }             
              ]
            },
            {
              "title":"Course Guide",
              "image_url":"https://hkn.eecs.berkeley.edu/assets/hkn_logo-18c8c978b4a2a023ded5f5bd60133af10734ced26402bc37ed239a9a18e9c017.png",
              "subtitle":"Visual flow-graph for order to take classes, as well as descriptions of most EECS courses written by students.",
              "buttons":[
                {
                  "type":"web_url",
                  "url":"https://hkn.eecs.berkeley.edu/courseguides",
                  "title":"See Course Guides"
                }             
              ]
            },
             {
              "title":"Department Tours",
              "image_url":"https://hkn.eecs.berkeley.edu/assets/hkn_logo-18c8c978b4a2a023ded5f5bd60133af10734ced26402bc37ed239a9a18e9c017.png",
              "subtitle":"Free tours for prospective students, run by current students.",
              "buttons":[
                {
                  "type":"web_url",
                  "url":"https://hkn.eecs.berkeley.edu/dept_tour",
                  "title":"More Info"
                }             
              ]
            }
          ]
        }
      }
    }
  return response;
}

function generateTextResponse(text) {
  return {"text": text};
}