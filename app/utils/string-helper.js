export default {
    upperCaseFirst: function(string) {
        if(!string || !string.length)
            return "";
        return string.charAt(0).toUpperCase() + string.substr(1);
    }
}
