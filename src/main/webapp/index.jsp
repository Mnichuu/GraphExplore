<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js"></script>
    <style>
        body { margin: 0; display: flex; flex-direction: column; height: 100vh; }
        #header { padding: 10px; background: #333; color: white; }
        #main { display: flex; flex: 1; }
        #sidebar { width: 250px; background: #f4f4f4; padding: 10px; }
        #graph { flex: 1; }
        #details { height: 120px; background: #ddd; padding: 10px; }
    </style>
</head>
<body>

<div id="header">
    <input type="file" id="fileInput">
    <button onclick="resetView()">Reset</button>
</div>

<div id="main">
    <div id="sidebar">
        <h3>Filtrowanie</h3>
        <input type="text" id="filterInput" placeholder="Szukaj...">

        <h3>Statystyki</h3>
        <div id="stats"></div>
    </div>

    <div id="graph"></div>
</div>

<div id="details">
    Kliknij wezel, aby zobaczyc szczegoly
</div>

<script>
    let chart = echarts.init(document.getElementById('graph'));

    let graphData = {
        nodes: [],
        links: []
    };

    function renderGraph(data) {
        chart.setOption({
            series: [{
                type: 'graph',
                layout: 'force',
                roam: true,
                data: data.nodes,
                links: data.links,
                label: { show: true },
                force: { repulsion: 100 }
            }]
        });
    }

    chart.on('click', function(params) {
        if (params.dataType === 'node') {
            document.getElementById('details').innerHTML =
                `<b>ID:</b> ${params.data.id}`;
        }
    });

    document.getElementById('fileInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = function() {
            const data = JSON.parse(reader.result);
            graphData = data;
            renderGraph(graphData);
            updateStats();
        };

        reader.readAsText(file);
    });

    function updateStats() {
        document.getElementById('stats').innerHTML =
            `Węzły: ${graphData.nodes.length}<br>Krawędzie: ${graphData.links.length}`;
    }

    function resetView() {
        renderGraph(graphData);
    }
</script>

</body>
</html>