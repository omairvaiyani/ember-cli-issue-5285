import Ember from 'ember';

export function highlightString(string, nonHighlightString, characterLimit) {
  if(!string && typeof characterLimit !== 'integer')
    return nonHighlightString;
  else if(!string)
    return nonHighlightString.substring(0,characterLimit)+"...";
  string = string.replace("<em>", "<strong>");
  string = string.replace("</em>", "</strong>");
  if(typeof characterLimit !== 'integer')
    return new Ember.Handlebars.SafeString(string);
  else
    return new Ember.Handlebars.SafeString(string.substring(0,characterLimit)+"...");
}

export default Ember.Handlebars.makeBoundHelper(highlightString);