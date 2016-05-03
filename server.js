// set up ======================================================================
var debug = require('debug')('apps:keywords');
var express = require('express');
var htmlToText = require('html-to-text');
var glossary = require("glossary")({verbose: true});
var app = express(); // create our app w/ express
var mongoose = require('mongoose'); // mongoose for mongodb
var port = 4000; // set the port
var http = require('http');
//var fs = require('fs');

// configuration ===============================================================
mongoose.connect('mongodb://localhost:27017/ReadboardV2'); // local

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

// === Request schema and model ===
var keywordsSchema = mongoose.Schema({
  _id: String,
  active: Boolean,
  keyword: String,
  slug: String,
  count: Number,
  realatedPosts: {
    type: Array
  },
  createdAt: {
    type: Date,
    default: new Date()
  }
});
var keywordsModel = mongoose.model('keywords', keywordsSchema, 'keywords');

var postContentSchema = mongoose.Schema({
  _id: String,
  url: String,
  fullContent: String,
  highlightObject: [{
    postId: String,
    content: String,
    highlightClass: String,
    userId: String,
    postcontent: String
  }],
  createdAt: {
    type: Date,
    default: new Date()
  }
});
var postContentModel = mongoose.model('postContent', postContentSchema, 'postContent');

// === END: Request schema and model ===

app.listen(port, function () {
  debug("App listening on port " + port);
  init();
});

function convertHtmlToText(htmlUrl, cb) {
  var text = htmlToText.fromString(htmlUrl);
  //debug('Inside convertHtmlToText', text);
  cb(text);
}

function findKeywords(text, cb) {
  var keywords = glossary.extract(text);
  //debug('Inside findKeywords',keywords);
  cb(keywords);
}

function insertKeywords(keywords, postIDs, index, cb) {
  //debug('creating objects :', index, '/', keywords.length);
  if (index < keywords.length) {
    var word = keywords[index];
    var slugToSave = word.word.toLowerCase().replace(/[^a-z0-9]/g, "-");
    var query = {'slug': slugToSave};
    //debug(postIDs);
    var newData = new Array;
    newData = postIDs;
    var t = new keywordsModel();
    t._id = mongoose.Types.ObjectId().toString();
    t.active = true;
    t.keyword = word.word;
    t.slug = slugToSave;
    t.count = word.count;
    t.relatedPosts = newData;
    t.markModified('relatedPosts');
    keywordsModel.findOne(query, function (err, keyword) {
        if (!err) {
          if (!keyword) {
            keyword = t;
          } else {
            debug('keyword Found');
            keyword.count = keyword.count + t.count;
            debug(postIDs);
            var newRelatedPosts = keyword.realatedPosts;
            for (var i = 0; i < postIDs.length; i = i + 1) {
              var postID = postIDs[i];
              if (newRelatedPosts.indexOf(postID) != -1) {
                newRelatedPosts.push(postID);
              }
            }
            keyword.relatedPosts = newRelatedPosts;
          }
          keyword.save(function (err) {
            if (!err) {
              //console.log("keyword saved:" + keyword);
              //debug('saving objects :', index, '/', keywords.length);
              cb('Success');
            }
            else {
              console.log("Error: could not save contact " + keyword);
              cb(err);
            }
          });
        }
      }
    );
    insertKeywords(keywords, postIDs, index + 1, cb);
  }
}

function convertAndInsertContentInKeywords(postContentData, index, cb) {
  if (index < postContentData.length) {
    debug('Proccecing :',index,'/',postContentData.length);
    var postContent = postContentData[index];
    var path = postContent.fullContent;
    var highlightedObject = postContent.highlightObject;
    var postIDs = [];
    for (var i = 0; i < highlightedObject.length; i = i + 1) {
      postIDs.push(highlightedObject[i].postId);
    }
    //debug(postIDs);
    convertHtmlToText(path, function (text) {
      findKeywords(text, function (keywords) {
        insertKeywords(keywords, postIDs, 0, function (err) {
          debug(err);
        });
      });
    });
    convertAndInsertContentInKeywords(postContentData, index + 1, cb);
  } else {
    debug('Insertion succesfull');
    cb('Success');
  }
}

function init() {
  debug('inside init');
  postContentModel.find(function (err, postContentData) {
    if (err) return console.error(err);
    //debug('post ContentsL:', postContentData);
    convertAndInsertContentInKeywords(postContentData, 0, function (str) {
      debug(str);
    });
  });
  //var keywords = glossary.extract("Urvish Sheth Designing for the Web vs. Apps in the Mobile Era Mobile is on rise, as are mobile apps. Although the web is still relevant, mobile apps are here to stay. These days, there is more and more pressure to deliver appealing user experience, and design does the job. In order to design delightful user experience, we need to understand what we are dealing with. Let’s start with understanding what web does for us and what apps do for us. Web was here for quite a long time and still is — under the name Responsive Web. The evolution of web was a direct response to evolving mobile context. So is there any difference in designing for web and designing for apps in the mobile era? Mobile is still growing, and apps are becoming a big part of our lives, helping us to move through our days. Mobile users have little time, short attention spans, small screens and can be easily distracted. Under this context, we will understand key goals for web and apps.");
  //debug(keywords);
}
