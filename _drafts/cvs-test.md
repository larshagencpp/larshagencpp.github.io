---
layout: post
title: "Csv test #1"
---

<div id="container" style="min-width: 310px; margin: 0 auto"></div>
<script>

function TransposeCsvData(data) {
	var new_data = []
	var header = data[0];
	for(var i in header) {
		new_data[i] = []
	}
	
	for(var i in data) {
		if(i > 0) {
			for(var j in data[i]) {
				if(new_data[j]) {
					new_data[j].push(data[i][j]);
				}
			}
		}
	}
	
	return new_data;
}

(function () {
	var request = new XMLHttpRequest();
	
	request.onreadystatechange = function() {
	  if (request.readyState == 4 && request.status == 200) {
		var data = $.csv.toArrays(request.responseText);
		var transformed = TransposeCsvData(data);
		$('#container').html("<pre>" + JSON.stringify(transformed, null, 2) + "</pre>");
	  }
	};
	
	request.open("GET", "/project/test/weather.csv", true);
	request.send();
})();
</script>