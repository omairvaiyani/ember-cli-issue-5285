import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    email: DS.attr('string'),
    spacedRepetitionActivated: DS.attr('boolean'),
    spacedRepetitionStartDate: DS.attr('parse-date'),
    spacedRepetitionExpiryDate: DS.attr('parse-date'),
    spacedRepetitionTrialStartDate: DS.attr('parse-date'),
    spacedRepetitionTrialExpiryDate: DS.attr('parse-date'),
    spacedRepetitionSignupSource: DS.attr('string'),
    spacedRepetitionLastPurchase: DS.attr('string'),
    spacedRepetitionSubscriptionCancelled: DS.attr('boolean')
});
