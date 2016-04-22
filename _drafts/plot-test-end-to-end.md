---
layout: post
title: "Plot test end2end"
---

This is another plot test.

{% include plot.html divid="weather" csvpath="/project/test/weather.csv" title="Monthly Average Temperature" ytitle="Temperature(C)" suffix="C" %}
{% include plot.html divid="perf" csvpath="/project/test/perf.csv" title="Performance" ytitle="Time(ms)" suffix="ms" %}
{% include plot.html divid="branch_prediction" csvpath="/project/incremental_sort/branch_prediction.csv" %}