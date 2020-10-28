<?php

$_SERVER['HTTPS'] = 'on';

$extension_map = array(
    "css" => "text/css",
    "js" => "application/javascript",
    "png" => "image/png",
    "jpeg" => "image/jpeg",
    "jpg" => "image/jpeg",
    "svg" => "image/svg+xml"
);

$request_uri = explode("?", $_SERVER['REQUEST_URI']);
$local_file_path = getenv('WORDPRESS_PATH')  . $request_uri[0];

$split = explode(".", $local_file_path);
$extension = strtolower(array_pop($split));
$mapped_type = null;
if (isset($extension_map[$extension])) {
    $mapped_type = $extension_map[$extension];
}

if ( $mapped_type && file_exists( $local_file_path ) ) {
    header("Content-Type: {$mapped_type}");
    readfile($local_file_path);

} elseif ( $extension == "php" && file_exists( $local_file_path ) ) {
    require( $local_file_path );

} elseif ( substr($local_file_path, -1) == "/" && file_exists( $local_file_path . "index.php" ) ) {
    $exec_file_path = $local_file_path . "index.php";
    require( $exec_file_path );

} else {
    $exec_file_path = getenv('WORDPRESS_PATH')  . '/index.php';
    require( $exec_file_path );
}
