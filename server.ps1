$port = 8081
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Server started. Open http://localhost:$port/ in your browser. Press Ctrl+C to stop."

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $localPath = $request.Url.LocalPath.TrimStart('/')
        if ($localPath -eq "") { $localPath = "index.html" }
        
        $fullPath = Join-Path (Get-Location).Path $localPath
        
        $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
        switch ($ext) {
            ".html" { $response.ContentType = "text/html; charset=UTF-8" }
            ".css"  { $response.ContentType = "text/css" }
            ".js"   { $response.ContentType = "application/javascript" }
            ".json" { $response.ContentType = "application/json" }
            ".png"  { $response.ContentType = "image/png" }
            ".jpg"  { $response.ContentType = "image/jpeg" }
            ".jpeg" { $response.ContentType = "image/jpeg" }
            ".svg"  { $response.ContentType = "image/svg+xml" }
            default { $response.ContentType = "application/octet-stream" }
        }

        if (Test-Path $fullPath -PathType Leaf) {
            $response.StatusCode = 200
            $stream = [System.IO.File]::OpenRead($fullPath)
            $response.ContentLength64 = $stream.Length
            $stream.CopyTo($response.OutputStream)
            $stream.Close()
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $msg.Length
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
