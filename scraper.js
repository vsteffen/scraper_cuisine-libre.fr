var request = require('request');
var cheerio = require('cheerio');
var URL = require('url-parse');

var START_URL = "http://www.cuisine-libre.fr/?page=recherche&recherche=&lang=fr&tri_recettes=titre&debut_recettes="; // In use ?
var BASE_URL = "http://www.cuisine-libre/";// In use ?
var SEARCH_WORD = "poulet1"; // In use ?
var TEST_URL1 = "http://www.cuisine-libre.fr/cheesecake-saveurs-abricots-et-pistaches?lang=fr";
var TEST_URL2 = "http://www.cuisine-libre.fr/cuisson-des-topinambours";
var TEST_URL3 = "http://www.cuisine-libre.fr/frites-de-panais-a-la-cannelle?lang=fr";
var TEST_URL4 = "http://www.cuisine-libre.fr/le-baiser-de-la-princesse";
var INGREDIENT_URL = "http://www.cuisine-libre.fr/ingredients";

var MAX_PAGES_TO_VISIT = 1; // In use ?
var PER_PAGE = 50; // In use ?
var TIME_TO_REQUEST = 3000;
var i = 0; // have to rename

var pagesToVisit = [];
var ingredientLink;
var indexIngredient = 143;
var lastPagIngredient = 0;
var indexPagIngredient = 0;

// +-+-+-+-+-+-+-+ DB SETUP +-+-+-+-+-+-+-+
var mongoClient = require('mongodb').MongoClient
var db;
var coll_ingredient;
var coll_recipe;
var idIngredientTmp;
var assert = require('assert'); // In use ?
var DB_URL = 'mongodb://localhost:27017/scraper_cuisine_libre_fr';
var url = 'mongodb://localhost:27017/scraper_cuisine_libre_fr'; // In use ?
var COLL_INGREDIENT = "ingredient";
var COLL_RECIPE = "recipe";

var initialCallback; // In use ?

var pagesVisited = {}; // In use ?
var numPagesVisited = 0; // In use ?
var maxPage = 0; // In use ?

/*
DB SCHEMA
└-> collection recipe
  └-> _id
  └-> url : string unique
  └-> title : string
  └-> author : string
  └-> img : string (path)
  └-> ingredient
    └-> id : char **
    └-> title : string
    └-> list : string
  └-> time
    └-> preparationTime : int 32
    └-> cookingTime : int 32
    └-> waitingTime : int 32
  └-> hint : string
  └-> tag : char **
  └-> license : string

└-> collection ingredient
  └-> _id
  └-> name : string unique
  └-> family ?
  └-> tag ?
  └-> recipe_id : char **
*/

function initIngredient(callback) {
  coll_ingredient = db.collection(COLL_INGREDIENT);
  coll_ingredient.find({}).toArray(function(err, docs) {
    assert.equal(err, null);
    if (!docs.length) {
      coll_ingredient.createIndex(
        { name : 1}, { unique : true},
        function(err, result) {
          assert.equal(err, null);
          console.log("      DB created with structure, continue scraping to fill it.")
          callback();
      });
    }
    else {
      console.log("     DB already created, continue scraping for update.");
      callback();
    }
  });
}

var removeIngredient = function(db, callback) {
  coll_ingredient.remove(function(err, result) {
    assert.equal(err, null);
    console.log("All ingredient document have been removed!");
    callback(result);
  });
}

function insertTEST(callback) {
  // var collection = db.collection(COLL_INGREDIENT);
  coll_ingredient.insertOne({name : 3}, function(err, result) {
    // assert.equal(err, null);
    // console.log("OBJECT RETURN -> " + result)
    console.log("INSERT TEST : n -> " + result.result.n + " / length -> " + result.ops.length)
    // assert.equal(3, result.result.n);
    // assert.equal(3, result.ops.length);
    // console.log("  DB TEST: inserted new ingredient");
    callback();
  });
}

function insertNewIngredient(name, callback) {
  coll_ingredient.findOne({name : name}, function(err, doc) {
      if (doc) {
        console.log("     --> DB: ingredient " + name + " already set.");
        idIngredientTmp = doc._id;
        callback();
      }
      else {
        coll_ingredient.insertOne({name : name, recipe_id : []}, function(err, res) {
          if (err) {
            callback(err);
          }
          else {
            console.log("     --> DB: inserted new ingredient -> " + name);
            idIngredientTmp = res.insertedId;
            callback();
          }
        });
      }
  });
}


function connectToDB(callback) {
  console.log("Scrapper cuisine-libre.fr v1.0 (https://github.com/vsteffen/scraper_cuisine-libre.fr)\n")
  mongoClient.connect(url, function(err, res) {
    db = res;
    if (err)
      callback(err);
    else {
      console.log("[OK] Connected correctly to server");
      initIngredient(function() {
        callback();
      });
    }
  });
}

function cleanDb(callback) {
  var collection = db.collection(COLL_INGREDIENT);
  collection.remove(function(err, result) {
    assert.equal(err, null);
    console.log("All ingredients document have been removed!");
    collection = db.collection(COLL_RECIPE);
    collection.remove(function(err, result) {
      assert.equal(err, null);
      console.log("All recipes document have been removed!");
      callback();
    });
  });
}

// scrapTest();
connectToDB(function(err) {
  if (err)
    return console.log(err);
    getAllIngredient(function(err) {
      if (err)
      return console.log(err);
      else {
        console.log("GOODJOB BROW")
      }
    });
});

function getAllIngredient(callback) {
  request(INGREDIENT_URL, function(err, res, body) {
    if (err) {
      callback(err);
    }
    else if (res.statusCode !== 200) {
      callback("[KO] Error while indexing all ingredients, url (" + INGREDIENT_URL + ") incorrect: Bad res from server (" + res.statusCode + ")");
    }
    else {
      var $ = cheerio.load(body);
      ingredientLink = $("#index > ul a");
      console.log("[OK] Found " + ingredientLink.length + " ingredients, launch crawler to get recipes associated to ingredient ...");
      loopForIngredient(function(err) {
        if (err)
          callback(err);
        callback(null);
      });
    }
  });
}

function loopForIngredient(callback) {
  indexIngredient++;
  if (indexIngredient < ingredientLink.length) {
    setTimeout(function () {
      console.log("");
      scrapIngredient(function(err){
        if (err)
          callback(err);
        else {
          loopForIngredient(callback);
        }
      });
    }, TIME_TO_REQUEST)
  }
  else
    callback(null);
}

function scrapIngredient(callback) {
  var url = ingredientLink.eq(indexIngredient).attr("href");
  var name = ingredientLink.eq(indexIngredient).text();
  console.log("[" + indexIngredient + "] Ingredient \"" + name + "\"");
  insertNewIngredient(name, function(err, res) {
    if (err) {
      callback(err);
    }
    else {
      request("http://www.cuisine-libre.fr/" + url, function(err, res, body) {
        if (err) {
          callback(err);
        }
        else if (res.statusCode !== 200) {
          callback("[KO] Error while scraping url (" + url + ") for ingredient: Bad res from server (" + res.statusCode + ")");
        }
        else {
          var $ = cheerio.load(body);
          var pagIngredient = $("#recettes > p.pagination a");
          console.log("     --> Url = " + url);
          if (pagIngredient.length) {
            lastPagIngredient = pagIngredient.last().text();
          }
          loopForPagIngredient(url.slice(0, url.indexOf("/")), function(err) {
            callback(null);
          })
        }
      });
    }
  })
}

function loopForPagIngredient(url, callback) {
  setTimeout(function () {
    collectUrlIngredient(url, function(err){
      if (err)
        callback(err);
      else {
        if (indexPagIngredient > lastPagIngredient) {
          console.log("[OK] This recipe is up to date!")
          indexPagIngredient = 0;
          lastPagIngredient = 0;
          callback(null);
        }
        else {
          loopForPagIngredient(url, callback);
        }
      }
    });
  }, TIME_TO_REQUEST)
}

function collectUrlIngredient(url, callback) {
  url = url + "?lang=fr&debut_recettes=" + indexPagIngredient;
  request("http://www.cuisine-libre.fr/" + url, function(err, res, body) {
    if (err) {
      callback(err);
    }
    else if (res.statusCode !== 200) {
      callback("[KO] Error while scraping url (" + url + ") for ingredient: Bad res from server (" + res.statusCode + ")");
    }
    else {
      var $ = cheerio.load(body);
      var recipeIdArray = [];
      var relativeLinks = $("#recettes > ul > li > a");
      console.log("     --> Found " + relativeLinks.length + " relative links - Page (" + (lastPagIngredient == 0 ? "1 / 1" : (indexPagIngredient / PER_PAGE + 1) + " / " + (lastPagIngredient / PER_PAGE + 1)) + ")");
      relativeLinks.each(function(index, link) {
        var found = pagesToVisit.some(function (elem) {
          return elem === $(link).attr('href');
        });
        if (!found) {
          // console.log("       New recipe detected --> " + $(link).attr('href'))
          pagesToVisit.push($(link).attr('href'));
        }
        else {
          // console.log("       This recipe already exist ! --> " + $(link).attr('href'))
        }
        recipeIdArray.push($(link).attr('href'));
      });
      coll_ingredient.update(
        {_id : idIngredientTmp},
        { $addToSet: { recipe_id : { $each: recipeIdArray }}},
        function(err, res) {
        if (err) {
          callback(err);
        }
        else {
          indexPagIngredient += PER_PAGE;
          callback();
        }
      });
    }
  });
}


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

      var selectLicense = $("#licence > p > a");
      if (selectLicense.length) {
        console.log("LICENSE = [" + selectLicense.text() + "]")
      }
      else
        console.log("LICENSE = [ERROR]")
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
    getDataRecipe(pagesToVisit[i], function(err){
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

function getDataRecipe(url, callback) {
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
