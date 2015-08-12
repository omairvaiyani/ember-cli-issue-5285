import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default Ember.Mixin.create({

    recentAttempts: new Ember.A(),

    getRecentAttemptsData: function () {
        if (this.get('recentAttempts.length'))
            return this.set('showRecentAttemptsChart', true);

        var where = {
            "user": ParseHelper.generatePointer(this.get('currentUser'), "_User"),
            "createdAt": {
                "$gte": moment().startOf("day").subtract(8, "d").toDate().toISOString()
            }
        };
        ParseHelper.findQuery(this, 'attempt', {where: where}).then(function (attempts) {
            this.get('recentAttempts').clear();
            this.get('recentAttempts').addObjects(attempts.sortBy('createdAt'));

            this.set('showRecentAttemptsChart', true);
        }.bind(this));
    },

    recentAttemptsChartData: function () {
        if (!this.get('recentAttempts.length'))
            return {labels: [], datasets: []};
        // Set up the date range
        var earliestDate = this.get('recentAttempts.firstObject').get('createdAt'),
            latestDate = this.get('recentAttempts.lastObject').get('createdAt'),
            dateRange = moment.range(moment(earliestDate).startOf("day"), moment(latestDate).startOf("day")),
            today = moment().startOf("day");

        // Set up the x-axis (days)
        var labels = [],
            dailyAverageScores = [];


        dateRange.by('days', function (day) {
            // Set up labels
            if (today.diff(day, "d") === 0)
                labels.push("Today");
            else
                labels.push(day.format("dddd"));
            var attempts = this.get('recentAttempts').filter(function (attempt) {
                return moment(attempt.get('createdAt')).startOf("day")
                        .diff(day.startOf("day"), "days") === 0;
            });

            // Set up data
            var totalScore = 0;
            attempts.forEach(function (attempt) {
                if (attempt.get('score'))
                    totalScore += attempt.get('score');
            });
            if (attempts.length === 0)
                dailyAverageScores.push(0);
            else
                dailyAverageScores.push(Math.round(totalScore / attempts.length));
        }.bind(this));

        // Add data to datasets
        var datasets = [
            {
                label: "Average Daily Score",
                fillColor: "rgba(231, 58, 61, 0.2)",
                strokeColor: "rgba(231, 58, 61,1)",
                pointColor: "rgba(231, 58, 61,1)",
                pointStrokeColor: "#fff",
                pointHighlightFill: "#fff",
                pointHighlightStroke: "rgba(229, 56, 69,1)",
                data: dailyAverageScores
            }
        ];

        return {labels: labels, datasets: datasets};
    }.property('recentAttempts.length'),

    recentAttemptsChartWidth: 800,

    recentAttemptChartOptions: {
        responsive: true,
        tooltipTemplate: "<%if (label){%><%=label%>: <%}%><%= value %>%"
    },

    actions: {
        createChart: function () {
            this.set('recentAttemptsChartWidth', $("#recentAttemptsChartHolder").width());
            this.getRecentAttemptsData();
        },
        closeChart: function () {
            this.set('showRecentAttemptsChart', false);
        }
    }
});
