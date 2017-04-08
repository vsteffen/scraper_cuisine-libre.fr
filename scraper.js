var request = require('request');
var cheerio = require('cheerio');
var URL = require('url-parse');

var START_URL = "http://www.cuisine-libre.fr/?page=recherche&recherche=&lang=fr&tri_recettes=titre&debut_recettes=";
var BASE_URL = "http://www.cuisine-libre.fr/";
var SEARCH_WORD = "poulet1";
var TEST_URL1 = "http://www.cuisine-libre.fr/cheesecake-saveurs-abricots-et-pistaches?lang=fr";
var TEST_URL2 = "http://www.cuisine-libre.fr/cuisson-des-topinambours";
var TEST_URL3 = "http://www.cuisine-libre.fr/frites-de-panais-a-la-cannelle?lang=fr";
var TEST_URL4 = "http://www.cuisine-libre.fr/le-baiser-de-la-princesse";

var MAX_PAGES_TO_VISIT = 1;
var PER_PAGE = 50;
var TIME_TO_REQUEST = 3000;
var i = 0;

var pagesVisited = {};
var numPagesVisited = 0;
var pagesToVisit = [];
var maxPage = 0;

// getAllUrl();

scrapTest();

function scrapTest() {
  console.log("Test Scrap ")
  request(TEST_URL4, function(err, res, body) {
    if (err) {
      callback(err);
    }
    else if (res.statusCode !== 200) {
      callback("Bad res from server (" + res.statusCode + ")");
    }
    else {
      var $ = cheerio.load(body);
      var selectAuthor = $(".auteur");
      if (selectAuthor.length)
        console.log("AUTHOR1 = [" + selectAuthor.text().substr(7) + "]")
      else
        console.log("AUTHOR1 = [cuisine-libre.fr]")

      var selectTitle = $("#preparation > h2");
      if (selectTitle.length)
        console.log("TITLE = [" + selectTitle.text() + "]")
      else
        console.log("TITLE = [ERROR]")

      var selectIngredient = $("#ingredients > div > ul > li");
      selectIngredient.each(function(i) {
        console.log("INGREDIENT[" + i + "] = [" + $(this).text().substr(1) + "]")
      });

      var selectImg = $(".photo");
      if (selectImg.length)
        console.log("IMG = [" + selectImg.attr("src") + "]")
      else
        console.log("IMG = []")

      var selectPreparationTime = $(".duree_preparation.prepTime");
      if (selectPreparationTime.length) {
        var timeStr = selectPreparationTime.text().substr(14);
        if (timeStr.indexOf("?") >= 0)
          console.log("PREP TIME = [UNKNOWN]")
        else {
          getTime(timeStr, function(time) {
            console.log("PREP TIME = [" + time + "] TOTAL");
          });
        }
      }
      else
        console.log("PREP TIME = [NO]")

      var selectCookingTime = $(".duree_cuisson.cookTime");
      if (selectCookingTime.length) {
        var timeStr = selectCookingTime.text().substr(10);
        if (timeStr.indexOf("?") >= 0)
          console.log("COOK TIME = [UNKNOWN]")
        else {
          getTime(timeStr, function(time) {
            console.log("COOK TIME = [" + time + "] TOTAL");
          });
        }
      }
      else
        console.log("COOK TIME = [NO]")

      var selectWaitingTime = $(".duree_marinade");
      if (selectWaitingTime.length) {
        var timeStr = selectWaitingTime.text().substr(10);
        if (timeStr.indexOf("?") >= 0)
          console.log("WAIT TIME = [UNKNOWN]")
        else {
          getTime(timeStr, function(time) {
            console.log("WAIT TIME = [" + time + "] TOTAL");
          });
        }
      }
      else
        console.log("WAIT TIME = [NO]")

      var selectTitleIngredient = $("#ingredients > h2");
      if (selectTitleIngredient.length) {
        console.log("TITLE INGREDIENT = [" + selectTitleIngredient.text() + "]")
      }
      else
        console.log("TITLE INGREDIENT = [ERROR]")

      var selectHint = $("#ps p");
      var hintStr = "";
      if (selectHint.length) {
        hintStr += selectHint.text();
      }
      selectHint = $("#variations p");
      if (selectHint.length) {
        if (hintStr === "")
          hintStr += selectHint.text();
        else
          hintStr += '\n' + selectHint.text();
      }
      if (hintStr !== "") {
        console.log("HINT = [" + hintStr + "]")
      }
      else {
        console.log("HINT = [NO]")
      }
      // collectImg($);
      // collectPreparationTime($);
      // collectInstructions($);
      // collectCookingTime($);

      // var relativeLinks = $(".auteur");
      // relativeLinks.each(function() {
      //   console.log("AUTHOR = [" + $(this).text() + "]")
      //   maxPage = $(this).text();
      // });
      // var relativeLinks = $(".auteur");
      // relativeLinks.each(function() {
      //   console.log("AUTHOR = [" + $(this).text() + "]")
      //   maxPage = $(this).text();
      // });
      // var relativeLinks = $(".auteur");
      // relativeLinks.each(function() {
      //   console.log("AUTHOR = [" + $(this).text() + "]")
      //   maxPage = $(this).text();
      // });
    }
  });
}

function getTime(timeStr, callback) {
  var time = 0;
  var index1;
  var index2;
  if ((index1 = timeStr.indexOf("J")) >= 0 || (index2 = timeStr.indexOf("j")) >= 0) {
    time = parseInt(timeStr) * 60 * 24;
    if (index1 >= 0)
      timeStr = timeStr.substr(index1 + 1);
    else
      timeStr = timeStr.substr(index2 + 1);
  }
  if ((index1 = timeStr.indexOf("H")) >= 0 || (index2 = timeStr.indexOf("h")) >= 0) {
    time += parseInt(timeStr) * 60;
    if (index1 >= 0)
      timeStr = timeStr.substr(index1 + 1);
    else
      timeStr = timeStr.substr(index2 + 1);
  }
  if ((index1 = timeStr.indexOf("M")) >= 0 || (index2 = timeStr.indexOf("m")) >= 0) {
    time += parseInt(timeStr);
  }
  callback(time);
}

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
  // console.log("KOUKOU")
  var index = 0;
  pagesToVisit.forEach(function(value) {
    index++;
    console.log("Val(" + index + ") = " + value);
  });
  i = -1;
  // for(var i2= 0; i2 < pagesToVisit.length; i2++)
  // {
  //      console.log("Val(" + i2 + ") = " + pagesToVisit[i2]);
  // }
  loopForScrap();
}

function loopForScrap() {
  setTimeout(function () {
    i++;
    scrapRecipe(pagesToVisit[i], function(err){
      if (err)
        return console.log(err);
      else {
        if (i < pagesToVisit.length) {
          loopForScrap();
        }
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
      collectTitle($);
      collectAuthor($);
      collectIngredient($);
      collectImg($);
      collectPreparationTime($);
      collectInstructions($);
      collectCookingTime($);
      callback();
      if (i == pagesToVisit.length) {
       last_function();
      }
    }
  });
}

function collectTitle($) {
  var relativeLinks = $("#recettes > ul > li > a");
    console.log("Found " + relativeLinks.length + " relative links for Title");
    relativeLinks.each(function() {
        console.log("Title = " + ($(this).attr('href')));
    });
}

function collectAuthor($) {
  var relativeLinks = $("#recettes > ul > li > a");
    console.log("Found " + relativeLinks.length + " relative links for Title");
    relativeLinks.each(function() {
        console.log("Title = " + ($(this).attr('href')));
    });
}

function collectIngredient($) {
  var relativeLinks = $("#recettes > ul > li > a");
    console.log("Found " + relativeLinks.length + " relative links for Title");
    relativeLinks.each(function() {
        console.log("Title = " + ($(this).attr('href')));
    });
}

function collectImg($) {
  var relativeLinks = $("#recettes > ul > li > a");
    console.log("Found " + relativeLinks.length + " relative links for Title");
    relativeLinks.each(function() {
        console.log("Title = " + ($(this).attr('href')));
    });
}

function collectPreparationTime($) {
  var relativeLinks = $("#recettes > ul > li > a");
    console.log("Found " + relativeLinks.length + " relative links for Title");
    relativeLinks.each(function() {
        console.log("Title = " + ($(this).attr('href')));
    });
}

function collectInstructions($) {
  var relativeLinks = $("#recettes > ul > li > a");
    console.log("Found " + relativeLinks.length + " relative links for Title");
    relativeLinks.each(function() {
        console.log("Title = " + ($(this).attr('href')));
    });
}

function collectCookingTime($) {
  var relativeLinks = $("#recettes > ul > li > a");
    console.log("Found " + relativeLinks.length + " relative links for Title");
    relativeLinks.each(function() {
        console.log("Title = " + ($(this).attr('href')));
    });
}

function last_function() {
  console.log("Success to scrap data and add to database")
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
