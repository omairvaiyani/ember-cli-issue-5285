# Synap API Documentation

### Prerequisites
In order to interact with the Synap API, either use 3rd party Titanium modules for the Parse SDK ([Android](https://github.com/ndizazzo/android-parse-titanium-module) and [iOS](https://github.com/ewindso/ios-parse-titanium-module)), or refer to Parse's [REST API Guide](https://parse.com/docs/rest/guide). All code in this document is previewed in Javascript. 

Please use [moment.js](http://momentjs.com/) for datetime manipulation and [JSTZ](http://pellepim.bitbucket.org/jstz/) for detecting timezones. Use the [Aviary SDK](https://developers.aviary.com/docs/android) for image manipulation. This document will assume that you use [underscore.js](http://underscorejs.org/) in Javascript, otherwise, use your own preferred methods to manipulate any JSON objects/arrays.

### Initialising the API
We are currently using the "Synap Dev" project on Parse. The following credentials will change
in the final release, so do not hard-code them.
```javascript
var parseApplicationId = "yUHivsy47OB5vVimMTV3s0Hc91a0vrM2JPM3aWst",
    parseJavascriptKey = "J4oAZA2qRHiCA324x0kQyEXiXuRXZPMA01wLN1xK";
Parse.initialize(parseApplicationId, parseJavascriptKey);

// Initialise Parse's Facebook wrapper
var synapFbAppId = "938285829544214";
window.fbAsyncInit = function() {
    Parse.FacebookUtils.init({ // this line replaces FB.init if you were to use FB's official SDK
      appId      : synapFbAppId, // Facebook App ID
      status     : true,  // check Facebook Login status
      cookie     : true,  // enable cookies to allow Parse to access the session
      xfbml      : true,  // initialize Facebook social plugins on the page
      version    : 'v2.3' // point to the latest Facebook Graph API version
    });
  };
    (function(d, s, id){
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) {return;}
    js = d.createElement(s); js.id = id;
    js.src = "//connect.facebook.net/en_US/sdk.js";
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));

```

Test out the API by running the following code:

```javascript
var APITestObject = Parse.Object.extend("APITestObject");
var testObject = new APITestObject();
testObject.set("testerName", "Jason");
testObject.save().then(function(object) {
    console.log("Yay! it worked");
}, function (error) {
    console.log(JSON.stringify(error));
});
```

### Initialising the App
Our API returns a session token upon successful logins: store this token on the device and check if it's valid on each boot.
```javascript
Parse.User.become("session-token-here").then(function (user) {
  // Token valid, 'user' object returned - set as a global var, 'currentUser'.
}, function (error) {
  // The token could not be validated.
});
```
Regardless of whether the session is valid, you must run a 'Cloud Code Function' called ```initialiseWebsiteForUser``` which returns a number of crucial objects/arrays - a separate function ```initialiseAppForUser``` will be created once we have a better idea of what objects are not as critical on boot, in mobile platforms.
```javascript
Parse.Cloud.run("initialiseWebsiteForUser").then(function (response) {
  // Store response.config and response.categories as global variables.
  // Remaining objects within the response object will be discussed further in the document.
}, function (error) {
    console.log(JSON.stringify(error));  
});
```

## Basics of Parse Objects
This sections is a brief run through of Parse Objects - This will help you follow along the rest of the API.

All objects in Parse belong to the ```Parse.Object``` class. Two default sub-classes of ```Parse.Object``` provided by Parse, which you must be aware of, are ```Parse.User``` and ```Parse.Installation```. You have dealt with ```Parse.User```
in the login/registration flow. ```Parse.Installation``` is created for mobile users, allowing us to track
device IDs, in-app purchases etc. 

```Parse.ACL``` is primarily used in Cloud Code, and allows us to manage 'access control' on objects - whilst front-end development will not utilise this class, it is worth being aware of.

```Parse.File``` are used for image storage: please read the [Parse.File](https://parse.com/docs/rest/guide#files) section on Parse when you come across it in this API doc.

All ```Parse.Object``` instances, including the defaults, have the following properties as default:
```javascript
{
    objectId: {String},
    createdAt: {Date},
    updatedAt: {Date},
    ACL: {Parse.ACL}
}
```
Objects in Parse can embed JSON Objects and Arrays within on of their properties, or contain a ```Pointer```,
like so:
```javascript
Parse.User = {
    ...
    educationCohort: {*EducationCohort}
    ...
}
```

Parse SDKs handle pointers automatically, like so:
```javasscript
{
currentUser.set('educationCohort', educationCohort);
// outputs as
// {"__type":"Pointer","className":"EducationCohort","objectId":"sOmeObj3ct1D"}
}
```
This JSON Object is identified by Parse, which manages relations during object
retrievals. If you are using a REST API alone, you will have to do create a
custom function which takes the ```objectId``` and sets the appropriate
```className```, outputting a JSON object, like so:
```javascript
{
var educationCohortPointer = customFunctionToGeneratePointer(educationCohort);
// {"__type":"Pointer","className":"EducationCohort","objectId":"sOmeObj3ct1D"}
currentUser.set('educationCohort', educationCohortPointer);
currentUser.save();
}
```

This 'pointer field' could also be an array of pointers, like so:
```javascript
Test = {
    ...
    questions: [*Question]
    // [{"__type":"Pointer","className":"Question","objectId":"sOmeObj3ct1D"},
    // {"__type":"Pointer","className":"Question","objectId":"sOmeObj3ct1D2"}, ...]
    ...
}
```
Pointers in the form of arrays are great as it reduces the response size on database queries.
However, by default, Parse will only return the pointers, rather than the actual objects. You
must ask Parse to  ```include``` pointer fields, as explained here: [Query Guide](https://parse.com/docs/rest/guide#objects-retrieving-objects)

An array with more than 100 pointers can become inefficient, and so for certain fields, we
use something called a ```Parse.Relation```. Please read this section to familiarise yourself
with relations and pointers: [Data Types](https://parse.com/docs/rest/guide#objects-data-types).

An example of a ```Parse.Relation``` in our schema is:
```javascript
Parse.User {
    ...
    followers: {Parse.Relation<Parse.User>},
    savedTests: {Parse.Relation<Test>},
    ...
}
```


### Registering New Users
#### By Email
```javascript
var newUser = new Parse.User();
newUser.set("name", "Firstname Surname");
// We are using emails as usernames, but Parse has special functionality for the 'email' property. Therefore,
// set the user's email on both username and email.
newUser.set("username", "email@example.com");
newUser.set("email", "email@example.com");
newUser.set("password", "password123");
newUser.set("signUpSource", "android"); // or iOS
newUser.set("timeZone", jstz().timezone_name);
user.signUp(null, {
  success: function(user) {
    // Set global variable, currentUser with returned user object
    // Locally save session token - user.get('sessionToken');
  },
  error: function(user, error) {
    // Show the error message somewhere and let the user try again.
    console.log("Error: " + error.code + " " + error.message);
  }
});
```

#### By Facebook
Make sure you have followed steps to set up the Facebook SDK.

```javascript
// FB.login opens a FB popup.
FB.login(function (response) {
    // user connected via fb
    if (response.authResponse) {
        // You can now query FB to find the following information about the user.
        FB.api('/me', {fields: 'name,education,gender,cover,email,friends'}, function (response) {
            // Prepare user data using information received from FB
            if (!response.cover)
                response.cover = {source: null};
            if (!response.friends)
                response.friends = {data: []};
            var fbFriendsArray = [],
                fbFriendsData = response.friends.data;
            for (var i = 0; i < fbFriendsData.length; i++) {
                fbFriendsArray.push(fbFriendsData[i].id);
            }
            var data = {
                username: response.email,
                email: response.email,
                name: response.name,
                fbid: response.id,
                gender: response.gender,
                fbEducation: response.education,
                fbCoverPicture: response.cover,
                fbFriends: fbFriendsArray,
                signUpSource: "android", // or iOS          
                timeZone: jstz().timezone_name,
                authData: {
                    facebook: {
                        access_token: authResponse.accessToken,
                        id: authResponse.userID,
                        // Expiration date must be at least 1 year in front
                        expiration_date: moment().add(1, "year").toDate()
                    }
                }
            };
        });
            // User data now prepared for registration
            signUpAuthorisedFacebookUser(data);
        }
    }, 
    { // FB permissions
        scope: 'public_profile, user_friends, user_about_me, user_education_history,' +
        'email, user_location' // user location may be removed unless we have good reason to keep it
});

var signUpAuthorisedFacebookUser = function (data) {
    var newUser = new Parse.User();
    newUser.signUp(data).then(function (user) {
        // Continue as you would with the 'Email' registration.
    }, function (error) {
        console.log(JSON.stringify(error));
    });
}    
```

## Setting Educational Info
This is done after registration as it decouples the process - the education info is either manually entered by the user or confirmed by the user from data returned through FB. Furthermore, an ```educationCohort``` is created based on the ```institution```, ```studyField``` and ```studyYear```. This allows us to group colleagues together. This process is somewhat complicated and so, it's best to keep it separate from the registration function.

#### Finding the Institution (without Facebook)
Ask for the user's university/college, school or workplace name in a text field. We have a list of universities and schools from around the world in our search index: use it for autocomplete.

```javascript
var searchEngineKey = "KpTvAqftjz7ZaGG7FPr7", // public key
    searchEngineUrl = "https://api.swiftype.com/api/v1/public/engines/suggest.json",
    recordType = "educational-institutions",
    params = {
            q: "University Name".toLowerCase(),
            engine_key: searchEngineKey
        };
$.getJSON(searchEngineUrl, params)
                .done(function (data) {
                        var records = data.records[recordType];
                        // Display records in a list
                });
```

If no records are found, allow user to continue with whatever name they typed. We will not be adding their educational institution to our search list for two reasons: a) users make typos too often and it will ruin our list, b) We have a second autocomplete method, through Facebook, which is more comprehensive. It can only be used for Facebook authenticated users (another reason for collecting educational information after registration).

Store this institution name (and whether it's a school, university of workplace by asking the user), in a variable. We'll need it in the next part.

#### Finding the Institution (with Facebook)
Either we'll have the user's educuational information through Facebook, or we can use Facebook's autocomplete to perform a similar function to the one above.

An example of Facebook's educational info JSON:
```javascript
{
      "concentration": [
        {
          "id": "103999666303070",
          "name": "Medicine"
        }
      ],
      "school": {
        "id": "103797159658620",
        "name": "University of Leeds"
      },
      "type": "College", // Eugh, It's University, Americans.
      "year": {
        "id": "127342053975510",
        "name": "2017" // this is the graduation year
      }
    }
```

Check if Facebook provided education info for the user:
```javascript
if(currentUser.get('fbEducation')) {
    // fbEducation will be an array of all educational courses/schools the user has listed on
    // their Facebook profile.
    var latestEducationalInfo = currentUser.get('fbEducation').sort(function (a, b) {
                return parseInt(b.year.name) - parseInt(a.year.name);
            });
    var educationalInstitutionObject = latestEducationalInfo.school, 
        // worth checking if this 'school' object is null or not.
        educationalInstitutionObject.type = latestEducationalInfo.type;
}
```
Confirm with the user that is indeed the educational info they want us to store.
Store the ```educationalInstitutionObject``` for now, we'll need it in the final part.

Else, use Facebook's search API to find educational institutions for autocomplete:
```javascript
FB.api('search', {q: "University Name".toLowerCase(), type: "page"},
        function (response) {
            var records = [];
            // Facebook will return everything from people, pages to groups.
            // We'll filter what we need.
            _.each(response.data, function (object) {
                // Consider a limit for the records.
                if(object.category === "University" || object.category === "School")
                    records.push(object);
            });
        });
```
Store the selected record, we'll need in the next part.

####  Creating the Institution
Once you have got at least the name for the ```eductionalInstition```, you can perform this step. Though having the ```educationalInstitution.type``` is handy.

```javascript
var newEducationCohort = {};
Parse.Cloud.run('createOrUpdateInstitution', {
                name: educationalInstitutionObject.name,
                facebookId: educationalInstitutionObject.facebookId, // if from Facebook
                type: educationalInstitutionObject.type
            }).then(function (result) {
                  newEducationCohort.institution = result.institution; // store this 
               }), function (error) {
                console.log(JSON.stringify(error));
            });
```            
This, ```newEducationCohort``` will be saved later and set onto the ```currentUser```.

#### Finding the Study Field (without Facebook)
Follow the same steps as for the ```institution``` code, but set ```recordType``` as ```"study-fields"```.

#### Finding the Study Field (with Facebook)
Follow the same steps as for ```institution```, with the following differences:
If educational information from their profile is found, run this code:

```javascript
var studyFieldObject = latestEducationalInfo.concentration;
    // worth checking if this 'concentration' object is null or not.
    
    // Store graduation year
    newEducationCohort.graduationYear = latestEducationalInfo.year.name;
```
Else, run the Facebook search API and filter in ```object.category``` === ```"Interest"``` or ```"Field of study"```. It's just how Facebook categories the results.

####  Creating the Study Field
Once you have got at least the name for the ```studyFiled```, you can perform this step.
```javascript
Parse.Cloud.run('createOrUpdateStudyField', {
                name: studyFieldObject.name,
                facebookId: educationalInstitutionObject.facebookId // if from Facebook
            }).then(function (result) {
                  newEducationCohort.studyField = result.studyField; // store this 
               }), function (error) {
                console.log(JSON.stringify(error));
            });
```    

#### Setting the Study Year
Simply dropdown selection. Facebook does provide a graduation date, which we can store in the final object (see next step), but we are not using this just yet. Store selected option as ```newEducationCohort.studyYear```.
```javascript
studyYearsToChooseFrom: [
        "Foundation Year", "Year 1", "Year 2", "Year 3",
        "Year 4", "Year 5", "Year 6", "Intercalation Year",
        "Master's", "Ph.D", "Professional Education"
    ];
```

#### Set Educational Cohort (Final step)
In order to create an ```educationCohort```, we need at least two of the three items collected above.
Send the items to the Cloud Function ```createOrGetEducationCohort```: the function will look
to see if this cohort exists and return it, else a new cohort will be created and sent back. Set
the returned object onto the current user's ```'educationCohort'``` property, and save the changes
for the user.
```javascript
Parse.Cloud.run('createOrGetEducationCohort', {
                    educationalInstitutionId: newEducationCohort.institution.id,
                    studyFieldId: newEducationCohort.studyField.id,
                    currentYear: newEducationCohort.currentYear,
                    graduationYear: newEducationCohort.graduationYear
                }).then(function (educationCohort) {
                    // This will either be a brand new educationCohort object,
                    // or a previously created cohort which matched this user's
                    // education info.
                    currentUser.set('educationCohort', educationChort);
                    return currentUser.save();
                }, function (error) {
                    console.log(JSON.stringify(error));
                });
```

## Creating a Quiz
Note: We use the term 'Quiz' for front-facing purposes, but the API uses the term 'Test'.
A ```Test``` object contains the following properties:
```javascript
{
    ... 
    // Parse.Object default properties
    ...
    title: {String}
    author: {*Parse.User},
    category: {*Category},
    questions: [*Question],
    tags: [String],
    description: {String},
    isPublic: {Boolean},
    ... 
    // Managed in Cloud 
    ...
    difficulty: {Number},
    totalQuestions: {Number},
    averageScore: {Number}
    numberOfAttempts: {Number}
    isGenerated: {Boolean},
    isSpacedRepetition: {Boolean},
    isProfessional: {Number},
    quality: {Number},
    slug: {String}
}
```
To begin creating a test, the minimum information required are the ```Test.title``` string, ```Test.category``` pointer and ```Test.author``` pointer:
```javascript
var Test = Parse.Object.extend("Test"),
    newTest = new Test();
// minimum    
newTest.set('title', "Algebra");    
newTest.set('author', currentUser);
// refer to the App Initialization section to get list of Category objects
newTest.set('category', selectedCategory); 
// extra
newTest.set('isPublic', true); // false by default
newTest.set('description', "This quiz is for beginners");
newTest.set('tags', ["Math 101", "GCSEs"]);
// Save Test to begin adding questions
Parse.Cloud.run('createNewTest', {test: newTest}).then(function (response) {
    var test = response.test;
    // test will now have an objectId
    // response contains additional information, primarily used for Gamification
});
```
Please note, after the initial ```Test``` object creation, you can update/save changes using
the default Parse save function ```newTest.save();```.

#### The Question object
A ```Question``` object contains the following properties:
```javascript
{
    ... 
    // Parse.Object default properties
    ...
    stem: {String}
    options: [String],
    feedback: {String},
    image: [Parse.File], // Read the Parse Object Basics section above 
    ...
    // Managed in Cloud
    ...
    difficulty: [Number],
    numberOfResponses: {Number},
    numberOfCorrectResponses: {Number},
    percentOfCorrectResponses: {Number}
}
```
The ```Question.stem``` string is the actual question displayed to the user.

```Question.options``` is an example of using directly embedded JSON arrays, instead of using Pointers. A typical ```Question.options``` array looks like this:
```javascript
[
    {"isCorrect":true,"phrase":"London"},
    {"isCorrect":false,"phrase":"Edinburgh"},
    {"isCorrect":false,"phrase":"Manchester"},
    {"isCorrect":false,"phrase":"Brighton"}
]
```
Note, we currently limit the total options to five, and a minimum of two. Only one option can be correct. These are opinionated practices, something which we may change in the future based on feedback.

#### Creating and Saving new questions
Create a new ```Question``` object - by default add four options, the first of which should be set as correct. Allow the user to remove unused options, or ignore empty options. Prompt the user to add an ```image``` and ```feedback```. Save the new question using the ```saveNewQuestion``` Cloud Code function.

```javascript
var Question = Parse.Object.extend("Question"),
    newQuestion = new Question();

newQuestion.set('stem', "What is the capital of UK?");
newQuestion.set('options', [...]);
newQuestion.set('feedback', "Edinburgh is the capital of Scotland, not the UK.");

Parse.Cloud.run('saveNewQuestion', {test: test, question: newQuestion}).then(function (response) {
    var question = response.question;
    // question will now have an objectId
    // response contains additional information, primarily used for Gamification
});
```
So far, you have only saved the ```Question``` object onto the database: you still need to assign this question to a quiz. The Cloud Function required the ```Test``` object as a parameter for Gamification purposes. It did not attach the question to said test you would need to repeat the process locally anyways.

#### Adding a saved question to a Quiz
Once you have run the above function, push the ```Question``` object into ```Test.questions```, and update the ```Test```:

```javascript
test.get('questions').push(question);
test.save();
```
#### Updating questions
You do not need to update a ```Test``` object when updating questions: ```question.save()``` is all that is needed.

#### Deleting questions
You MUST update a ```Test``` object when deleting questions:
```javascript
var updatedQuestionsList = _.reject(test.get('questions'), function(object) { return object.id === question.id; });
test.set('questions', updatedQuestionsList);    
test.save();

// Do not delete the question using Parse's default delete function. We have a custom Cloud Function which
// handles the process carefully for our purposes
Parse.Cloud.run('deleteObjects', {"className":"Question", objects:[question]);
```
#### Additional Info for Quizzes
Note that ```Test.questions``` are shuffled each time a quiz is taken, as are ```Question.options```. Therefore, when adding or removing questions to tests, or options to questions, the order does not matter.

Questions, whilst created for a particular test, can be attached to multiple tests. For example, when a 'Spaced Repetition' test is 'generated', our Cloud Code will pull questions from other tests, in order to generate an entirely new test. This is why the ```Question``` class does not contain any parent info.

Images for questions are optional, but encouraged: use the [Aviary SDK](https://developers.aviary.com/docs/android) for image manipulation.

## Finding Quizzes
This is the 'Discovery' part of Synap. Whilst Parse has a sophisticated query system, they do not handle 'keyword' searching well enough for our needs. This is because indexing large datasets is complicated, therefore we use a third-party service called [Algolia](https://www.algolia.com/), to index our content for efficient, and useful searching.

Things to consider:
1. Everytime a new object (users and tests for now) is created, Cloud Code sends a replica to Algolia
2. Everytime an object is updated, changes are relayed to Algolia
3. Algolia stores and returns the object as a JSON, NOT as a Parse.Object
4. Not only does Algolia have separate classes like Parse, but for each class, data is cloned for various assortment types (i.e. A-Z, Most Recent, Difficulty, etc.), to speed up searching

Due to point 3, when you perform searches through Aloglia, the returned objects will need to be converted to Parse.Objects. This is relatively simple to achieve on the client, and will be explained further down.

#### Setting up Algolia
This doc will refer to Alogolia's [Javascript Docs](https://www.algolia.com/doc/javascript), though they also have [other SDKs](https://www.algolia.com/doc). Follow steps to include their SDK into the project. Initialize the search client like so:
```javascript
var algoliaAppId = "ONGKY2T0Y8",
    algoliaAppKey = "8553807a02b101962e7bfa8c811fd105";

var searchClient = algoliasearch(algoliaAppId, 8553807a02b101962e7bfa8c811fd105);
// Store searchClient globally
```

#### Performing a Basic Quiz Search
Here's a simple example search - Finding all quizzes in the Cardiology category:
```javascript
var testIndex = searchClient.initIndex('Test'),
    aviationCategoryId = "MnOS2t6h1A";

testIndex.search('',
            {
                facets: "category.objectId",
                facetFilters: ["category.objectId:"+aviationCategoryId],
                hitsPerPage: 10
            }).then(function (response) {
                var totalHitsFound = response.nbHits,
                    unparsedTests = response.hits;
                // unparsedTests will be converted to Parse.Object instances, explained further    
            });
```
Before discussing the specifics of how the facets and facetFilters work (which you can learn more about [here](https://www.algolia.com/doc/javascript#faceting)), let's see how the response objects are converted to 
Parse.Object instances:

```javascript
unparsedTests; // Array of tests received from Algolia
var tests = [],
    props = ["title", "author", "category", "description", "questions", "difficulty",
                        "totalQuestions", "tags", "slug", "isPublic", "averageScore", "numberOfAttempts",
                    "isGenerated", "isPublic", "isProfessional", "isSpacedRepetition", "quality"];
                    
_.each(unparsedTests, function (unparsedTest) {
    var test = new Test(); // or new Parse.Object("Test");
    test.id = unparsedTest.objectId;
    _.each(props, function (prop) {
        test.set(prop, unparsedTest.prop);
    });
    tests.push(test);
});
// Do not try to save these tests
```
Ideally, this process would be done on Cloud Code, unfortunately, when objects are created locally like this - they must be saved before Parse allows us to send them to/from Cloud Code. This would increase the latency significantly, and so, client-side searching must perform these actions locally.

***Section not yet complete***

