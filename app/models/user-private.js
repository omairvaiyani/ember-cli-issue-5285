import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    email: DS.attr('string'),
    username: DS.attr('string'),
    spacedRepetitionActivated: DS.attr('boolean'),
    spacedRepetitionStartDate: DS.attr('parse-date'),
    spacedRepetitionExpiryDate: DS.attr('parse-date'),
    spacedRepetitionTrialStartDate: DS.attr('parse-date'),
    spacedRepetitionTrialExpiryDate: DS.attr('parse-date'),
    spacedRepetitionSignupSource: DS.attr('string'),
    spacedRepetitionLastPurchase: DS.attr('string'),
    spacedRepetitionSubscriptionCancelled: DS.attr('boolean'),
    isPremium: DS.attr('boolean'),
    premiumStartDate: DS.attr('parse-date'),
    premiumNextPayment: DS.attr('parse-date'),
    premiumExpiryDate: DS.attr('parse-date'),
    premiumTrialStartDate: DS.attr('parse-date'),
    premiumTrialExpiryDate: DS.attr('parse-date'),
    premiumSignupSource: DS.attr('string'),
    premiumLastPurchase: DS.attr('string'),
    premiumCancelled: DS.attr('boolean'),
    premiumMonthTrialRedeemed: DS.attr('boolean')
});
