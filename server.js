const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

try
{
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });
} catch
{
    console.log('Failed to fetch index.html');
}

try
{
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    }); 
} catch
{
    console.log('Failed to run server on port 3000');
}