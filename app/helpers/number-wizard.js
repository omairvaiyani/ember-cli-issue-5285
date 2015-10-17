import Ember from 'ember';

export function numberWizard(number/*, hash*/) {
  if(!number)
    return 0;

  return numeral(number).format('0.0a');
}

export default Ember.Handlebars.makeBoundHelper(numberWizard);
