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
					if(isNaN(data[i][j])) {
						new_data[j].push(data[i][j]);
					}
					else {
						new_data[j].push(Number(data[i][j]));
					}
				}
			}
		}
	}
	
	return new_data;
}