# Synap API Documentation

### Prerequisites
In order to interact with the Synap API, either use 3rd party Titanium modules for the Parse SDK ([Android](https://github.com/ndizazzo/android-parse-titanium-module) and [iOS](https://github.com/ewindso/ios-parse-titanium-module)), or refer to Parse's [REST API Guide](https://parse.com/docs/rest/guide). All code in this document is previewed in Javascript. 
Please use [moment.js](http://momentjs.com/) for datetime manipulation and [JSTZ](http://pellepim.bitbucket.org/jstz/) for detecting timezones.

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

### Setting Educational Info
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

#### Study Field (without Facebook)
Follow the same steps as for the ```institution``` code, but set ```recordType``` as ```"study-fields"```.

#### Study Field (with Facebook)
Follow the same steps as for ```institution```, with the following differences:
If educational information from their profile is found, run this code:

```javascript
var studyFieldObject = latestEducationalInfo.concentration;
    // worth checking if this 'concentration' object is null or not.
    
    // Store graduation year
    newEducationCohort.graduationYear = latestEducationalInfo.year.name;
```
Else, run the Facebook search API and filter in ```object.category``` === ```"Interest"``` or ```"Field of study"```. It's just how Facebook categories the results.

#### Study Year
Simply dropdown selection. Facebook does provide a graduation date, which we can store in the final object (see next step), but we are not using this just yet. Store selected option as ```newEducationCohort.studyYear```.
```javascript
studyYearsToChooseFrom: [
        "Foundation Year", "Year 1", "Year 2", "Year 3",
        "Year 4", "Year 5", "Year 6", "Intercalation Year",
        "Master's", "Ph.D", "Professional Education"
    ];
```
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
#### Set Educational Cohort (Final step)
In order to create an ```educationCohort```, we need at least two of the three items collected above.
First, create the object locally like so:
```javascript
ParseHelper.cloudFunction(this, 'createOrGetEducationCohort', {
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
More info to follow.





