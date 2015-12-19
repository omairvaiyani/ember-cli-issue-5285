export default

{
    /**
     * @Function Name
     * @param {string} name
     * @returns {String|Boolean} if false, no error, else message.
     */
    name: function (name) {
        if(!name || !name.length)
            return "Please enter your name!";
        else if (name.split(' ').length < 2)
            return "Please enter your full name!";
        else
            return false;
    },

    /**
     * @Function Email
     * @param {string} Email
     * @returns {String|Boolean} if false, no error, else message.
     */
    email: function (email) {
        if(!email || !email.length)
            return "Please enter you email!";

        var atpos = email.indexOf("@");
        var dotpos = email.lastIndexOf(".");
        if (atpos < 1 || dotpos < atpos + 2 || dotpos + 2 >= email.length) {
            return "This email is not valid!";
        } else {
            return false;
        }
    },

    /**
     * @Function Password
     * @param {string} password
     * @returns {String|Boolean} if false, no error, else message.
     */
    password: function(password) {
        if (!password || !password.length)
            return "Please enter your password!";
        else if (password.length < 6)
            return "This password is too short! (min 6 characters)";
        else
            return false;
    },

    url: function (url) {
        var urlValidator = new RegExp(
            "^" +
                // protocol identifier
            "(?:(?:https?|ftp)://)" +
                // user:pass authentication
            "(?:\\S+(?::\\S*)?@)?" +
            "(?:" +
                // IP address exclusion
                // private & local networks
            "(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
            "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
            "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +
                // IP address dotted notation octets
                // excludes loopback network 0.0.0.0
                // excludes reserved space >= 224.0.0.0
                // excludes network & broacast addresses
                // (first & last IP address of each class)
            "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
            "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
            "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
            "|" +
                // host name
            "(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)" +
                // domain name
            "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*" +
                // TLD identifier
            "(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))" +
                // TLD may end with dot
            "\\.?" +
            ")" +
                // port number
            "(?::\\d{2,5})?" +
                // resource path
            "(?:[/?#]\\S*)?" +
            "$", "i"
        );
        return urlValidator.test(url);
    }
}
