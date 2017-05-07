var request = require('request');
var cheerio = require('cheerio');
var URL = require('url-parse');
var fs = require('fs');
var request = require('request');
var assert = require('assert');

// +-+-+-+-+-+-+-+ CONST +-+-+-+-+-+-+-+-+
var BASE_URL = "http://www.cuisine-libre.fr/";
var INGREDIENT_URL = "http://www.cuisine-libre.fr/ingredients";
var IMG_FOLDER = "/img/"; // Folder where you want to save images (created where you launch the scraper)
var PER_PAGE = 50; // Number of ingredients or recipes per page
var TIME_TO_REQUEST = 3000; // time in milliseconds to request between each page / be nice with their servers, put at least more than 1 second (1000)

// +-+-+-+-+-+-+-+ DB SETUP +-+-+-+-+-+-+
var mongoClient = require('mongodb').MongoClient
var DB_URL = 'mongodb://localhost:27017/scraper_cuisine_libre_fr'; // Settings to connect to your own database with mongodb
var COLL_INGREDIENT = "ingredient"; // name collection of ingredient
var COLL_RECIPE = "recipe"; // name collection of recipes
var db;
var coll_ingredient;
var coll_recipe;

// +-+-+-+-+-+-+ VAR SCRAPER +-+-+-+-+-+-+
var pagesToVisit = [];
var ingredientLink;
var indexIngredient = -1; //change it to start at [n - 1] ingredient
var lastPagIngredient = 0;
var indexPagIngredient = 0;
var idIngredientTmp;
var urlRecipeTmp;
var indexRecipe = -1; //change it to start at [n - 1] recipe
var recipe_error = 0;

/*
DB SCHEMA:

└-> collection ingredient
  └-> _id
  └-> name : string unique
  └-> family (not implemented now)
  └-> tag (not implemented now)
  └-> recipe_id : char **

└-> collection recipe
  └-> _id
  └-> url : string unique
  └-> title : string unique
  └-> author : string
  └-> imgPath : string (path)
  └-> ingredient
    └-> id : char ** (not implemented now)
    └-> title : string
    └-> list : string
    └-> diet : int 32 // 0 -> "normal" / 1 -> vegetarian / 2 -> Vegan
  └-> instruction : string
  └-> time
    └-> preparationTime : int 32
    └-> cookingTime : int 32
    └-> waitingTime : int 32
  └-> hint : string
  └-> tag : char ** (not implemented now)
  └-> license : string

*/

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
      initRecipe(function (err) {
        if (err) {
          console.log(err);
          process.exit(1);
        }
        else {
          loopForRecipe(function (err) {
            if (err) {
              console.log(err);
              process.exit(1);
            }
            else {
              console.log("\n[OK] Success: all recipes are up to date!");
              if (recipe_error)
                console.log("[WARNING] " + recipe_error + " recipe(s) encountered an error.")
              console.log("\n[END] All data were collected, scraper ends now.");
              process.exit();
            }
          })
        }
      })
    }
  });
});

function connectToDB(callback) {
  console.log("Scrapper cuisine-libre.fr v1.2 (https://github.com/vsteffen/scraper_cuisine-libre.fr)")
  console.log("Refer to this page about the legal mentions (http://www.cuisine-libre.fr/mentions-legales?lang=fr)\n")
  mongoClient.connect(DB_URL, function(err, res) {
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
  verifyImgFolder(__dirname + IMG_FOLDER, function (err) {
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
            console.log("     DB for recipes already created, continue scraping for update.");
            callback();
          }
        });
    }
  })
}

function verifyImgFolder(imgFolder, callback) {
  fs.stat(imgFolder, function (err, stats){
    if (err) {
      fs.mkdir(imgFolder, function (err) {
        if (err)
          callback("[KO] Impossible to create folder for img (" + imgFolder + ")")
        else {
          console.log("     Create folder img (" + imgFolder + ")");
          callback();
        }
      });
    }
    else {
      console.log("     Folder img already created (" + imgFolder + ")");
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

function loopForRecipe(callback) {
  indexRecipe++;
  if (indexRecipe < pagesToVisit.length) {
    setTimeout(function () {
      urlRecipeTmp = pagesToVisit[indexRecipe];
      console.log("");
      console.log("[" + (indexRecipe + 1) +"] Recipe " + urlRecipeTmp);
      scrapRecipe(function(err, res){
        if (err)
          callback(err);
        else {
          if (res)
            console.log(res);
          else
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
    else if (doc) {
      callback(null, "[OK] This recipe has already been scrapped.");
    }
    else {
      request(BASE_URL + urlRecipeTmp, function(err, res, body) {
        if (err) {
          recipe_error++;
          coll_recipe.remove({url : urlRecipeTmp}, function(err, res) {
            if (err)
              callback(err);
            else
              callback(null, "[KO] Something went wrong with this recipe. Test if this url is working : [" + BASE_URL + urlRecipeTmp + "]. Maybe this is the case where there is an infinite loop (like  bol-de-quinoa-aux-fruits-secs).\n");
          });
        }
        else if (res.statusCode !== 200) {
          callback("Bad res from server (" + res.statusCode + ")");
        }
        else {
          var $ = cheerio.load(body);
          collectBasics($, function (err) {
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
  var selectImg = $("#content > div.illustration img");
  if (selectImg.length) {
    var imgUrl = selectImg.attr("src").replace('//','http://');
    filename = __dirname + IMG_FOLDER + urlRecipeTmp + ".jpeg";
    downloadImg(imgUrl, filename, function(err) {
      if (err)
        callback(err);
      else {
        coll_recipe.update(
          { url : urlRecipeTmp},
          { $set: { imgPath : IMG_FOLDER + urlRecipeTmp + ".jpeg" }},
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
  request.head(url, function(err, res, body){
    if (err) {
      callback("[KO] Can't download this image (" + url + ") for recipe " + urlRecipeTmp +".")
    }
    else {
      request(url).pipe(fs.createWriteStream(filename)).on('close', callback);
    }
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
      collectIngredientDiet($, function (diet) {
        var embedded_field = {};
        embedded_field.title = title;
        embedded_field.list = list;
        embedded_field.diet = diet;
        coll_recipe.update(
          { url : urlRecipeTmp},
          { $set: { ingredient : embedded_field }},
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

function collectIngredientDiet($, callback) {
  var selectDietIngredient = $("#miam > img").attr('title');
  if (selectDietIngredient === "Végétarien") {
    callback(1);
  }
  else if (selectDietIngredient === "Végétalien") {
    callback(2);
  }
  else {
    callback(0);
  }
}

function collectInstruction($, callback) {
  var selectInstruction = $("#preparation > div");
  if (selectInstruction.length) {
    selectInstruction = selectInstruction.text().replace(/(?:\r\n|\r|\n)/g, '< br/>');
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
