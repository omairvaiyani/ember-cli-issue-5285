import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default Ember.Mixin.create({

    /**
     * @Property Recent Attempts
     *
     * Takes the currentUser's testAttempts and
     * returns the last 8 days worth, sorted by
     * createdAt (ASC).
     */
    recentAttempts: function () {
        if (!this.get('currentUser.testAttempts'))
            return new Ember.A();

        return this.get('currentUser.testAttempts').filter(function (attempt) {
            return moment().startOf("day").diff(moment(attempt.get('createdAt')), "days") < 8;
        }).sortBy("createdAt");
    }.property('currentUser.testAttempts.length'),

    recentAttemptsChartData: function () {
        var chartInfo = {labels: [], datasets: []};
        // Prepare labels
        for (var i = 0; i < 7; i++) {
            chartInfo.labels.push(moment().startOf("day").subtract(i, "days").format("dddd"));
        }

        // Prepare datasets
        var averageDailyScoreDataSet =
        {
            label: "Average Daily Score",
            fillColor: "rgba(231, 58, 61, 0.2)",
            strokeColor: "rgba(231, 58, 61,1)",
            pointColor: "rgba(231, 58, 61,1)",
            pointStrokeColor: "#fff",
            pointHighlightFill: "#fff",
            pointHighlightStroke: "rgba(229, 56, 69,1)",
            data: []
        };
        chartInfo.datasets.push(averageDailyScoreDataSet);

        if (!this.get('recentAttempts.length'))
            return chartInfo;

        // Set up the date range
        var earliestDate = this.get('recentAttempts.firstObject').get('createdAt'),
            latestDate = this.get('recentAttempts.lastObject').get('createdAt'),
            dateRange = moment.range(moment(earliestDate).startOf("day"), moment(latestDate).startOf("day")),
            today = moment().startOf("day");

        // Set up the x-axis (days)
        chartInfo.labels = [];
        var dailyAverageScores = [];


        dateRange.by('days', function (day) {
            // Set up labels
            if (today.diff(day, "d") === 0)
                chartInfo.labels.push("Today");
            else
                chartInfo.labels.push(day.format("dddd"));
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
        averageDailyScoreDataSet.data = dailyAverageScores;

        return chartInfo;
    }.property('recentAttempts.length'),

    recentAttemptsChartWidth: 800,

    recentAttemptChartOptions: {
        responsive: true,
        tooltipTemplate: "<%if (label){%><%=label%>: <%}%><%= value %>%"
    },

    actions: {
        createChart: function () {
            this.set('recentAttemptsChartWidth', $("#recentAttemptsChartHolder").width());
            this.set('showRecentAttemptsChart', true);
        },
        closeChart: function () {
            this.set('showRecentAttemptsChart', false);
        }
    }
});
