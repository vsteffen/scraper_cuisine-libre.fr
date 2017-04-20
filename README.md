## Mentions légal / Legal notice
Tous les ingrédients et recettes récupérés appartiennent à [www.cuisine-libre.fr](http://www.cuisine-libre.fr). Si vous utilisez la base de données générée par ce scraper, vous devez respectez les conditions indiquées dans les mentions légales du site à cette addresse [www.cuisine-libre.fr/mentions-legales](http://www.cuisine-libre.fr/mentions-legales).

All the ingredients and recipes scraped belong to [www.cuisine-libre.fr](http://www.cuisine-libre.fr). If you use the database generated by this scraper, you must respect the conditions indicated in the legal mentions of the site to this address [www.cuisine-libre.fr/mentions-legales](http://www.cuisine-libre.fr/legal-mentions).

### Info
Il s'agit d'un simple projet que j'ai utilisé afin d'apprendre les bases du Node JS et Mongodb. Je n'ai trouvé aucune base de données gratuite, avec une license libre donc j'ai créé ce scraper pour récupérer les données libres du site cuisine-libre.fr.

This is a simple project i use to learn basic Node JS and Mongodb. I found no free database with a free license so I created this scraper to retrieve the free data from the site cuisine-libre.fr.

## Installation
Installation avec NPM / Install with npm:
```sh
npm install scraper_cuisine_libre.fr
```
Cloner le dépôt / Clone the repo:
```sh
git clone https://github.com/vsteffen/scraper_cuisine-libre.fr
```
Vous pouvez changer selon vos besoins les paramètres du scraper tout en haut du fichier scraper.js.
You can change the scraper settings at the top of the scraper.js file according to your needs.

## Output
Avec les paramètres par défaut, vous obtiendrez le résultat suivant / With the default settings, you will get the following example:
```
Ingrédient :
{
    "_id" : ObjectId("xxx"),
    "name" : "Ingrédient",
    "recipe_id" : [
        "lien-relatif-a-la-recette1",
        "lien-relatif-a-la-recette2",
        "..."
    ]
}

Recette :
{
    "_id" : ObjectId("xxx"),
    "url" : "lien-relatif-a-la-recette",
    "title" : "Titre de la recette",
    "author" : "Romy",
    "imgPath" : "/path/to/file.jpeg",
    "hint" : "Astuce si présente",
    "license" : "Type de la license",
    "ingredient" : {
        "title" : "Titre des ingrédients",
        "list" : [
            "10 g de carrotte",
            "300 g laitue",
            "..."
        ],
        "diet" : pratique alimentaire, 0 = aucune, 1 = végétarien, 2 = végétalien
    },
    "instruction" : "Instructions pour votre formidable recette",
    "time" : {
        "preparation" : préparation en min,
        "cooking" : cuisson en min
        "waiting" : attente en min
    }
}
```


**By Vivien STEFFEN (https://github.com/vsteffen)**
