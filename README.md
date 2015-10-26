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












