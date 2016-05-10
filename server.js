// set up ======================================================================
var debug = require('debug')('apps:keywords');
var express = require('express');
var htmlToText = require('html-to-text');
var commonBlacklistedWords = require('./blacklist_keywords.js');
var glossary = require("glossary")({
  blacklist: commonBlacklistedWords,
  verbose: true
});
var app = express(); // create our app w/ express
var mongoose = require('mongoose'); // mongoose for mongodb
var port = 4000; // set the port
var http = require('http');
var _ = require('underscore-node');
const minWordLength = 3;
var blacklistRegX = [/[^a-zA-Z0-9]+/g, /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/];
//var fs = require('fs');

// configuration ===============================================================
//mongoose.connect('mongodb://localhost:27017/ReadboardV2'); // local
mongoose.connect('mongodb://192.168.0.23:27017/ReadboardV2Live'); // local

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

// === Request schema and model ===
var articleSchema = mongoose.Schema({
  id: String,
  count: Number
});
var articlesModel = mongoose.model('articles', articleSchema, 'articles');

var postsSchema = mongoose.Schema({
  id: String
});
var postsModel = mongoose.model('posts', postsSchema, 'posts');

var keywordsSchema = mongoose.Schema({
  _id: String,
  active: Boolean,
  keyword: String,
  slug: String,
  count: Number,
  posts: [postsSchema],
  articles: [articleSchema],
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
  cb(removeUnwantedWords(keywords));
}

function removeUnwantedWords(allWords) {
  var wantedWords = [];

  for (var i = 0; i < allWords.length; i++) {
    var matched = false;
    var word = allWords[i].word;
    if (word.length < minWordLength) continue;
    for (var j = 0; j < blacklistRegX.length; j++) {
      const regEx = blacklistRegX[j];
      if (regEx.test(word)) {
        matched = true;
        break;
      }
    }
    if (!matched)wantedWords.push(allWords[i]);
  }

  return wantedWords;
}

function insertKeywords(keywords, postIDs, postContentID, index, cb) {
  //debugger;
  //debug('creating objects :', index, '/', keywords.length);

  if (index >= keywords.length) {
    cb('Completed...');
    return;
  }

  var word = keywords[index];
  var slugToSave = word.word.toLowerCase().replace(/[^a-z0-9]/g, "-");
  var query = {'slug': slugToSave};
  var articles = {count: word.count, id: postContentID};
  //debug(postIDs);

  var a = new articlesModel(articles);
  var postData = [];
  for (var i = 0; i < postIDs.length; i = i + 1) {
    var pdata = {id: postIDs[i]};
    var p = new postsModel(pdata);
    postData.push(p);
  }
  var data = {
    _id: mongoose.Types.ObjectId().toString(),
    active: true,
    keyword: word.word,
    slug: slugToSave,
    count: word.count,
    posts: postData,
    articles: [a]
  };

  var t = new keywordsModel(data);
  t._doc.posts = postData;
  t._doc.articles = [a];
  t.markModified('posts');
  t.markModified('articles');
  //debug(t.relatedPosts);

  keywordsModel.findOne(query, function (err, keyword) {
      if (!err) {
        if (!keyword) {
          keyword = t;
        } else {
          //debug('keyword Found');
          debugger;
          keyword.count = keyword.count + t.count;
          var newPosts = keyword._doc.posts;
          for (var i = 0; i < t.posts.length; i = i + 1) {
            var postID = t.posts[i];
            var found = _.find(newPosts, function (pID) {
              return (postID.id.match(pID.id) == -1);
            });
            if (found == undefined) {
              var pData = postID;
              var pToAdd = new postsModel(pData);
              newPosts.push(pToAdd);
            }
          }
          keyword.posts = newPosts;
          keyword._doc.posts = newPosts;
          keyword.markModified('posts');
          var newArticles = keyword._doc.articles;
          var found = _.find(newArticles, function (item) {
            return (postContentID.match(item.id) == -1);
          });
          if (found == undefined) {
            newArticles.push(a);
          }
          keyword.articles = newArticles;
          keyword.markModified('articles');
        }
        keyword.save(function (err) {
          if (!err) {
            //debug('saving objects :', index, '/', keywords.length);
          }
          else {
            console.log("Message: Could not save keyword " + keyword + "Error :" + err);
          }
          insertKeywords(keywords, postIDs, postContentID, index + 1, cb);
        });
      }
    }
  );
}

function convertAndInsertContentInKeywords(postContentData, index, cb) {
  if (index < postContentData.length) {
    debug('Processing :', index, '/', postContentData.length);
    var postContent = postContentData[index];
    var path = postContent.fullContent;
    var postContentID = postContent._id;
    var highlightedObject = postContent.highlightObject;
    var postIDs = [];
    postIDs = _.pluck(highlightedObject, 'postId');
    //debug(postIDs);
    convertHtmlToText(path, function (text) {
      findKeywords(text, function (keywords) {
        insertKeywords(keywords, postIDs, postContentID, 0, function (err) {
          debug(err);
          convertAndInsertContentInKeywords(postContentData, index + 1, cb);
        });
      });
    });
  } else {
    debug('Insertion Successful');
    cb('Success');
  }
}

function init() {
  debug('inside init');
  postContentModel.find(function (err, postContentData) {
    if (err) return console.error(err);
    convertAndInsertContentInKeywords(postContentData, 0, function (str) {
      //debug(str);
    });
  });
}
