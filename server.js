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
mongoose.connect('mongodb://localhost:27017/keywords_db'); // local

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

// === Request schema and model ===
var keywordsSchema = mongoose.Schema({
  _id: String,
  active: Boolean,
  keyword: String,
  slug: String,
  count: Number,
  createdAt: {
    type: Date,
    default:new Date()
  }
});
var keywordsModel = mongoose.model('keywords', keywordsSchema, 'keywords');
// === END: Request schema and model ===

app.listen(port, function () {
  debug("App listening on port " + port);
  init();
});

function convertHtmlToText(htmlUrl, cb) {
  debug('Inside convertHtmlToText',htmlUrl);
  htmlToText.fromFile('content.html',{}, function (err, text) {
    debug('Inside fromString');
    if (err) {
      debug(err);
      return;
    }
    cb(err,text);
  });
}

function findKeywords(text, cb) {
  debug('Inside findKeywords');
  var keywords = glossary.extract(text);
  cb(keywords);
}

function insertKeywords(keywords, index, cb) {
  debug('Inside insertKeywords',keywords,keywords.length);
  if(index < keywords.length){
    var word = keywords[index];
    var slugToSave = word.word.toLowerCase().replace(/[^a-z0-9]/g,"-");
    var query = {'slug':slugToSave};
    var t = new keywordsModel({
      _id: mongoose.Types.ObjectId().toString(),
      active: true,
      keyword: word.word,
      slug: slugToSave,
      count: word.count
    });
    debug('Inside insertKeywords t:', t);
    //keywordsModel.findOneAndUpdate(query, t, {upsert:true,fields:}, function(err, doc){
    //  if (err) {
    //    debug(err);
    //    return;
    //  }
    //  debug(t);
    //  if (doc){
    //    cb('Success');
    //  }
    //});
    keywordsModel.findOne(query, function(err, keyword) {
      debug('Inside insertKeywords err:',err);
      if(!err) {
        if(!keyword) {
          keyword = t;
        }else{
          keyword.count = keyword.count+ t.count;
        }
        keyword.save(function(err) {
          if(!err) {
            console.log("keyword saved:" + keyword);
            cb('Success');
          }
          else {
            console.log("Error: could not save contact " + keyword);
            cb(err);
          }
        });
      }
    });
    insertKeywords(keywords,index + 1,cb);
    }
  }


function init() {
  debug('inside init');
  var path = '/content.html';
  convertHtmlToText(path, function(err,text){
    if(err){
      debug(err);
      return;
    }
    findKeywords(text, function(keywords){
      insertKeywords(keywords, 0,function(err){
        debug(err);
      });
    });
  });
  //var keywords = glossary.extract("Urvish Sheth Designing for the Web vs. Apps in the Mobile Era Mobile is on rise, as are mobile apps. Although the web is still relevant, mobile apps are here to stay. These days, there is more and more pressure to deliver appealing user experience, and design does the job. In order to design delightful user experience, we need to understand what we are dealing with. Let’s start with understanding what web does for us and what apps do for us. Web was here for quite a long time and still is — under the name Responsive Web. The evolution of web was a direct response to evolving mobile context. So is there any difference in designing for web and designing for apps in the mobile era? Mobile is still growing, and apps are becoming a big part of our lives, helping us to move through our days. Mobile users have little time, short attention spans, small screens and can be easily distracted. Under this context, we will understand key goals for web and apps.");
  //debug(keywords);
}


/**
 * Insert words tranaction
 * @param  {Object} request         Request object
 */
function insertKeywordTransaction(requestData, cb) {
  console.log('insert payment transaction request: ', JSON.stringify(requestData));
  users.findOne({
    _id: requestData.providerId
  }, function (err, userResponse) {
    if (err) {
      console.log('error: find provider user data: ', err);
      cb();
      return;
    }
    var providerUser = userResponse._doc;
    var requestId = requestData._id;
    var totalPrice = requestData.amount.total;
    var commission = requestData.amount.commission;
    var providerFee = parseFloat(totalPrice) - parseFloat(commission);
    var customerId = requestData.paymentDetail.customerId;
    var addressId = requestData.paymentDetail.addressId;
    var tokenId = requestData.paymentDetail.tokenId;
    var consumerId = requestData.userID;
    var subMerchantId = providerUser.profile.provider.bankDetails.subMerchantId;

    var transaction = {
      _id: mongoose.Types.ObjectId().toString(),

    };
    console.log('inserting payment transaction...');
    var pt = new paymentTransaction(transaction);
    pt.save(transaction, function (err, saveResponse) {
      if (err) {
        console.log('error: insert payment transaction: ', err);
        cb();
        return;
      }
      console.log('payment transaction inserted...: ', saveResponse);
      cb();
    });
  });
}
/**
 * Insert payment tranaction
 * @param  {Object} request         Request object
 */
/*function insertPaymentTransaction(requestData, cb) {
 console.log('insert payment transaction request: ', JSON.stringify(requestData));
 users.findOne({
 _id: requestData.providerId
 }, function(err, userResponse) {
 if (err) {
 console.log('error: find provider user data: ', err);
 cb();
 return;
 }
 var providerUser = userResponse._doc;
 var requestId = requestData._id;
 var totalPrice = requestData.amount.total;
 var commission = requestData.amount.commission;
 var providerFee = parseFloat(totalPrice) - parseFloat(commission);
 var customerId = requestData.paymentDetail.customerId;
 var addressId = requestData.paymentDetail.addressId;
 var tokenId = requestData.paymentDetail.tokenId;
 var consumerId = requestData.userID;
 var subMerchantId = providerUser.profile.provider.bankDetails.subMerchantId;

 var transaction = {
 _id: mongoose.Types.ObjectId().toString(),
 requestId: requestId,
 type: 'escrow',
 datetime: new Date(),
 amount: {
 total: totalPrice.toString(),
 commission: commission.toString(),
 providerFee: providerFee.toString()
 },
 customerId: customerId,
 addressId: addressId,
 consumerId: consumerId,
 subMerchantId: subMerchantId,
 tokenId: tokenId
 };
 console.log('inserting payment transaction...');
 var pt = new paymentTransaction(transaction);
 pt.save(transaction, function(err, saveResponse) {
 if (err) {
 console.log('error: insert payment transaction: ', err);
 cb();
 return;
 }
 console.log('payment transaction inserted...: ', saveResponse);
 cb();
 });
 });
 }*/
