var request = require('request');
var cheerio = require('cheerio');
var URL = require('url-parse');

var START_URL = "http://www.cuisine-libre.fr/?page=recherche&recherche=&lang=fr&tri_recettes=titre&debut_recettes=";
var BASE_URL = "http://www.cuisine-libre.fr/";
var SEARCH_WORD = "poulet1";
var MAX_PAGES_TO_VISIT = 1;
var PER_PAGE = 50;
var TIME_TO_REQUEST = 3000;
var i = 0;

var pagesVisited = {};
var numPagesVisited = 0;
var pagesToVisit = [];
var maxPage = 0;

getAllUrl();

function getAllUrl() {
  console.log("START")
  getMaxPage(function(err) {
    if (err)
      return console.log(err);
    else {
      loopForCrawl();
    }
  });
}

function getMaxPage(callback) {
  console.log("Ask max page ... ")
  request(START_URL, function(err, res, body) {
    if (err) {
      callback(err);
    }
    else if (res.statusCode !== 200) {
      callback("Bad res from server (" + res.statusCode + ")");
    }
    else {
      var $ = cheerio.load(body);
      var relativeLinks = $("#recettes > p.pagination > span > a:last-child");
      relativeLinks.each(function() {
        console.log("MAX PAGE = [" + $(this).text() + "]")
        maxPage = $(this).text();
        callback(null);
      });
    }
  });
}

function loopForCrawl() {
  setTimeout(function () {
    i++;
    getUrlActualPage(i, function(err){
      if (i * PER_PAGE <= maxPage) {
       loopForCrawl();
      }
    });
  }, TIME_TO_REQUEST)
}

function getUrlActualPage(actualPage, callback) {
  request(START_URL + (actualPage - 1) * PER_PAGE, function(err, res, body) {
    if (err) {
      callback(err);
    }
    else if (res.statusCode !== 200) {
      callback("Bad res from server (" + res.statusCode + ")");
    }
    else {
      var $ = cheerio.load(body);
      collectRecipesLink($);
      callback();
      if (i * PER_PAGE > maxPage) {
       scrapRecipe();
      }
    }
  });
}

function collectRecipesLink($) {
  var relativeLinks = $("#recettes > ul > li > a");
    // console.log("$(this) = [" + relativeLinks + "]")
    // .clearfix > a
    console.log("Found " + relativeLinks.length + " relative links - Page " + i + " (" + ((i * PER_PAGE) - 50) + " / " + i * PER_PAGE + ")");
    relativeLinks.each(function() {
          // console.log("Node = [" + $(this) + "]")
        pagesToVisit.push($(this).attr('href'));
    });
}


function scrapRecipe() {
  console.log("KOUKOU")
  // pagesToVisit.forEach(function(value) {
  //   console.log("Val(" +  + ") = " value);
  // });
  i = -1;
  for(var i2= 0; i2 < pagesToVisit.length; i2++)
  {
       console.log("Val(" + i2 + ") = " + pagesToVisit[i2]);
  }
  loopForScrap();
}

function loopForScrap() {
  setTimeout(function () {
    i++;
    scrapRecipe(pagesToVisit[i], function(err){
      if (i < pagesToVisit.length) {
       loopForScrap();
      }
    });
  }, TIME_TO_REQUEST)
}

function scrapRecipe(url, callback) {
  request(BASE_URL + url, function(err, res, body) {
    if (err) {
      callback(err);
    }
    else if (res.statusCode !== 200) {
      callback("Bad res from server (" + res.statusCode + ")");
    }
    else {
      var $ = cheerio.load(body);
      collectRecipesLink($);
      callback();
      if (i * PER_PAGE > maxPage) {
       scrapRecipe();
      }
    }
  });
}

function testNode(callback) {
  var callBackString = {};
  callBackString.value1 = "value1";
  callBackString.value2 = "value2";
  callBackString.value3 = "value3";
  // var err = new Error;
  // err.mdr = "CPAKOOL"
  callback(callBackString, null);
}

function searchForWord($, word) {
  var bodyText = $('#recettes > ul > li > a').text().toLowerCase();
  // console.log("bodyText = [" + bodyText + "]")
  return(bodyText.indexOf(word.toLowerCase()) !== -1);
}
