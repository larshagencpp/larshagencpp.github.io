---
layout: post
title: "Plot test end2end"
---

{% include plot.html divid="weather" csvpath="/project/test/weather.csv" title="Monthly Average Temperature" ytitle="Temperature(C)" suffix="C" %}
{% include plot.html divid="perf" csvpath="/project/test/perf.csv" title="Performance" ytitle="Time(ms)" xtitle="N" suffix="ms" ytype="logarithmic" %}