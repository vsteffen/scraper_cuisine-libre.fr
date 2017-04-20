var request = require('request');
var cheerio = require('cheerio');
var URL = require('url-parse');
var fs = require('fs'),
    request = require('request');


var START_URL = "http://www.cuisine-libre.fr/?page=recherche&recherche=&lang=fr&tri_recettes=titre&debut_recettes="; // In use ?
var BASE_URL = "http://www.cuisine-libre.fr/";// In use ?
var SEARCH_WORD = "poulet1"; // In use ?
var TEST_URL1 = "http://www.cuisine-libre.fr/cheesecake-saveurs-abricots-et-pistaches?lang=fr";
var TEST_URL2 = "http://www.cuisine-libre.fr/cuisson-des-topinambours";
var TEST_URL3 = "http://www.cuisine-libre.fr/frites-de-panais-a-la-cannelle?lang=fr";
var TEST_URL4 = "http://www.cuisine-libre.fr/le-baiser-de-la-princesse";
var TEST_URL5 = "http://www.cuisine-libre.fr/chips-et-frites-de-butternut-sans-gras?lang=fr"
var TEST_URL6 = "http://www.cuisine-libre.fr/veloute-magenta";
var INGREDIENT_URL = "http://www.cuisine-libre.fr/ingredients";
var IMG_FOLDER = __dirname + "/res/img/";

var MAX_PAGES_TO_VISIT = 1; // In use ?
var PER_PAGE = 50; // In use ?
var TIME_TO_REQUEST = 3000;
var i = 0; // have to rename

var pagesToVisit = [];
var ingredientLink;
var indexIngredient = 364;
var lastPagIngredient = 0;
var indexPagIngredient = 0;
var indexRecipe = -1;

// +-+-+-+-+-+-+-+ DB SETUP +-+-+-+-+-+-+-+
var mongoClient = require('mongodb').MongoClient
var db;
var coll_ingredient;
var coll_recipe;
var idIngredientTmp;
var urlRecipeTmp;
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
  └-> title : string unique
  └-> author : string
  └-> imgPath : string (path)
  └-> ingredient
    └-> id : char ** ?
    └-> title : string
    └-> list : string
  └-> instruction : string
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

// scrapTest();

connectToDB(function(err) {
  if (err) {
    console.log(err);
    process.exit(1);
  }
  getAllIngredient(function(err) {
    if (err) {
      console.log(err);
      process.exit(1);
    }
    else {
      console.log("\n[OK] Success: all ingredients are up to date!");
      console.log("\n[OK] Found " + pagesToVisit.length + " recipes, launch scraper to get data of recipes ...");
      initRecipe(function () {
        loopForRecipe(function (err) {
          if (err) {
            console.log(err);
            process.exit(1);
          }
          else {
            console.log("\n[OK] Success: all recipes are up to date!");
            console.log("\n[END] All data were collected, scraper ends now.");
            process.exit();
          }
        })
      })
    }
  });
});

function connectToDB(callback) {
  console.log("Scrapper cuisine-libre.fr v1.0 (https://github.com/vsteffen/scraper_cuisine-libre.fr)\n")
  console.log("Refer to this page about the legal mentions (http://www.cuisine-libre.fr/mentions-legales?lang=fr)")
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

function initIngredient(callback) {
  coll_ingredient = db.collection(COLL_INGREDIENT);
  coll_ingredient.find({}).toArray(function(err, docs) {
    assert.equal(err, null);
    if (!docs.length) {
      coll_ingredient.createIndex(
        { name : 1, title : 1}, { unique : true},
        function(err, result) {
          assert.equal(err, null);
          console.log("      DB for ingredients created with structure, continue scraping to fill it.")
          callback();
      });
    }
    else {
      console.log("     DB for ingredients already created, continue scraping for update.");
      callback();
    }
  });
}

function initRecipe(callback) {
  verifyImgFolder(function (err) {
    if (err)
      callback(err);
    else {
      coll_recipe = db.collection(COLL_RECIPE);
      coll_recipe.find({}).toArray(function(err, docs) {
        assert.equal(err, null);
        if (!docs.length) {
          coll_recipe.createIndex(
            { url : 1}, { unique : true},
            function(err, result) {
              assert.equal(err, null);
              console.log("     DB for recipes created with structure, continue scraping to fill it.")
              callback();
            });
          }
          else {
            console.log("    DB for recipes already created, continue scraping for update.");
            callback();
          }
        });
    }
  });
}

function verifyImgFolder(callback) {
  fs.stat(IMG_FOLDER, function (err, stats){
    if (err) {
      fs.mkdir(IMG_FOLDER, function (err) {
        if (err)
          callback("     Impossible to create folder for img (" + IMG_FOLDER + ")")
        else {
          console.log("     Create folder img (" + IMG_FOLDER + ")");
          callback();
        }
      });
    }
    else {
      console.log("     Folder img already created (" + IMG_FOLDER + ")");
      callback();
    }
  });
}

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
      console.log("[OK] Found " + ingredientLink.length + " ingredients, launch scraper to get recipes associated to ingredient ...");
      loopForIngredient(function(err) {
        if (err)
          callback(err);
        else
          callback();
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
    callback();
}

function scrapIngredient(callback) {
  var url = ingredientLink.eq(indexIngredient).attr("href");
  var name = ingredientLink.eq(indexIngredient).text();
  console.log("[" + (indexIngredient + 1) + "] Ingredient \"" + name + "\"");
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
          callback();
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
      console.log("     --> Found " + relativeLinks.length + " relatives links - Page (" + (lastPagIngredient == 0 ? "1 / 1" : (indexPagIngredient / PER_PAGE + 1) + " / " + (lastPagIngredient / PER_PAGE + 1)) + ")");
      relativeLinks.each(function(index, link) {
        var found = pagesToVisit.some(function (elem) {
          return elem === $(link).attr('href');
        });
        if (!found)
          pagesToVisit.push($(link).attr('href'));
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

// function scrapRecipe() {
//   // console.log("KOUKOU")
//   var index = 0;
//   pagesToVisit.forEach(function(value) {
//     index++;
//     console.log("Val(" + index + ") = " + value);
//   });
//   i = -1;
//   // for(var i2= 0; i2 < pagesToVisit.length; i2++)
//   // {
//   //      console.log("Val(" + i2 + ") = " + pagesToVisit[i2]);
//   // }
//   loopForScrap();
// }

function loopForRecipe(callback) {
  indexRecipe++;
  if (indexRecipe < pagesToVisit.length) {
    setTimeout(function () {
      urlRecipeTmp = pagesToVisit[indexRecipe];
      console.log("");
      console.log("[" + (indexRecipe + 1) +"] Recipe " + urlRecipeTmp);
      scrapRecipe(function(err){
        if (err)
          callback(err);
        else {
          console.log("[OK] This recipe is up to date!");
          loopForRecipe(callback);
        }
      });
    }, TIME_TO_REQUEST)
  }
  else
    callback();
}

function scrapRecipe(callback) {
  verifyRecipe(function(err, doc) {
    if (err)
      callback(err);
    else if (doc)
      callback();
    else {
      request(BASE_URL + urlRecipeTmp, function(err, res, body) {
        if (err) {
          callback(err);
        }
        else if (res.statusCode !== 200) {
          callback("Bad res from server (" + res.statusCode + ")");
        }
        else {
          var $ = cheerio.load(body);
          collectBasics($, function () {
            if (err)
            callback(err);
            else {
              collectIngredient($, function(err) {
                if (err)
                callback(err);
                else {
                  collectInstruction($, function(err) {
                    if (err)
                    callback(err);
                    else {
                      collectTime($, function(err) {
                        if (err)
                        callback(err);
                        else {
                          callback();
                        }
                      })
                    }
                  })
                }
              })
            }
          });
        }
      });
    }
  });
}

function verifyRecipe(callback) {
  coll_recipe.findOne({url : urlRecipeTmp}, function(err, doc) {
      if (doc) {
        console.log("     --> DB: recipe " + urlRecipeTmp + " already set.");
        callback(null, true);
      }
      else {
        coll_recipe.insertOne({url : urlRecipeTmp}, function(err, res) {
          if (err) {
            callback(err);
          }
          else {
            console.log("     --> DB: inserted new recipe -> " + urlRecipeTmp);
            callback(null, false);
          }
        });
      }
  });
}

function collectBasics($, callback) {
  collectTitle($, function (err, res) {
    if (err)
      callback(err);
    else {
      collectAuthor($, function (err, res) {
        if (err)
          callback(err);
        else {
          collectImg($, function (err, res) {
            if (err)
              callback(err);
            else {
              collectHint($, function (err, res) {
                if (err)
                  callback(err);
                else {
                  collectLicense($, function (err, res) {
                    if (err)
                      callback(err);
                    else {
                      callback();
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
  });
}

function collectTitle($, callback) {
  var selectTitle = $("#preparation > h2");
  if (!selectTitle.length)
    callback("Title not found on this url (" + urlRecipeTmp + ")");
  else {
    selectTitle = selectTitle.text();
    coll_recipe.update(
      { url : urlRecipeTmp},
      { $set: { title : selectTitle }},
      function(err, res) {
        callback(err);
    })
  }
}

function collectAuthor($, callback) {
  var selectAuthor = $(".auteur");
  if (selectAuthor.length)
    selectAuthor = selectAuthor.text().substr(7);
  else
    selectAuthor = "cuisine-libre.fr";
  coll_recipe.update(
    { url : urlRecipeTmp},
    { $set: { author : selectAuthor }},
    function(err, res) {
      callback(err);
  })
}

function collectImg($, callback) {
  var selectImg = $(".photo");
      console.log("KOUKOU TOI")
  if (selectImg.length) {
    selectImg = selectImg.attr("src");
    filename = IMG_FOLDER + url + ".jpeg";
    console.log("KOUKOU TOI")

    downloadImg(selectImg, filename, function(err){
      if (err)
        callback(err);
      else {
        coll_recipe.update(
          { url : urlRecipeTmp},
          { $set: { imgPath : filename }},
          function(err, res) {
            callback(err);
          })
      }
    });
  }
  else
    callback();
}

function downloadImg (url, filename, callback){
  console.log("KOUKOU TOI")
  request.head(url, function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);
    if (err)
      callback("    [KO] Can't download this image (" + url + ") for recipe " + urlRecipeTmp +".")
    else
      request(url).pipe(fs.createWriteStream(filename)).on('close', callback());
  });
};



function collectHint($, callback) {
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
    coll_recipe.update(
      { url : urlRecipeTmp},
      { $set: { hint : hintStr }},
      function(err, res) {
        callback(err);
    })
  }
  else {
    callback();
  }
}
function collectLicense($, callback) {
  var selectLicense = $("#licence > p > a");
  if (selectLicense.length) {
    selectLicense = selectLicense.text();
  }
  else
    selectLicense = "license libre";
  coll_recipe.update(
    { url : urlRecipeTmp},
    { $set: { license : selectLicense }},
    function(err, res) {
      callback(err);
  })
}

function collectIngredient($, callback) {
  collectIngredientTitle($, function (title) {
    collectIngredientList($, function (list) {
      var embedded_field = {};
      embedded_field.title = title;
      embedded_field.list = list;
      coll_recipe.update(
        { url : urlRecipeTmp},
        { $set: { ingredient : embedded_field }},
        function(err, res) {
          callback(err);
      })
    });
  });
}

function collectInstruction($, callback) {
  var selectInstruction = $("#preparation > div");
  if (selectInstruction.length) {
    selectInstruction = selectInstruction.text().replace(/(?:\r\n|\r|\n)/g, '< br/>');
    // var str = selectInstruction.text(); //.replace(/(?:\r\n|\r|\n)/g, '< br/>');
    // console.log("CHARCODE -> " + str.charCodeAt(str.indexOf("mixer. Ajouter") - 1) + " AAAAAAAAAAND " + (str[str.indexOf("mixer. Ajouter") - 1]))
    coll_recipe.update(
      { url : urlRecipeTmp},
      { $set: { instruction : selectInstruction }},
      function(err, res) {
        callback(err);
    })
  }
  else
    callback("[KO] No instruction scrapped for this url (" + urlRecipeTmp + ")!")
}

function collectTime($, callback) {
  collectTimePreparation($, function (preparation) {
    collectTimeCooking($, function (cooking) {
      collectTimeWaiting($, function (waiting) {
        var embedded_field = {};
        if (preparation)
          embedded_field.preparation = preparation;
        if (cooking)
          embedded_field.cooking = cooking;
        if (waiting)
          embedded_field.waiting = waiting;
        coll_recipe.update(
          { url : urlRecipeTmp},
          { $set: { time : embedded_field }},
          function(err, res) {
            callback(err);
        })
      });
    });
  });
}

function collectIngredientTitle($, callback) {
  var selectTitleIngredient = $("#ingredients > h2");
  if (selectTitleIngredient.length) {
    callback(selectTitleIngredient.text());
  }
  else {
    callback("Ingrédients :")
  }
}

function collectIngredientList($, callback) {
  var listIngredient = [];
  var selectIngredient = $("#ingredients > div > ul > li");
  selectIngredient.each(function(i) {
    listIngredient.push($(this).text().substr(1));
  });
  callback(listIngredient);
}

function collectTimePreparation($, callback) {
  var selectPreparationTime = $(".duree_preparation.prepTime");
  if (selectPreparationTime.length) {
    var timeStr = selectPreparationTime.text().substr(14);
    if (timeStr.indexOf("?") >= 0)
      callback();
    else {
      getTime(timeStr, function(time) {
        callback(time);
      });
    }
  }
  else
    callback();
}

function collectTimeCooking($, callback) {
  var selectCookingTime = $(".duree_cuisson.cookTime");
  if (selectCookingTime.length) {
    var timeStr = selectCookingTime.text().substr(10);
    if (timeStr.indexOf("?") >= 0)
      callback();
    else {
      getTime(timeStr, function(time) {
        callback(time);
      });
    }
  }
  else
    callback();
}

function collectTimeWaiting($, callback) {
  var selectWaitingTime = $(".duree_marinade");
  if (selectWaitingTime.length) {
    var timeStr = selectWaitingTime.text().substr(10);
    if (timeStr.indexOf("?") >= 0)
      callback();
    else {
      getTime(timeStr, function(time) {
        callback(time);
      });
    }
  }
  else
    callback();
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
