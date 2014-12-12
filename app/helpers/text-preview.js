import Ember from 'ember';

export default Ember.Handlebars.makeBoundHelper(function(text, length) {
    if(!text)
        return "";
    if(text.length > 27)
        return text.substring(0,length)+"...";
    else
        return text;
});
