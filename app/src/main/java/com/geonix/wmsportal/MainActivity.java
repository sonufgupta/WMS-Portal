
package com.geonix.wmsportal;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JsPromptResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

public class MainActivity extends Activity {

    private WebView webView;
    private ProgressBar progressBar;

    private static final String HOME_URL =
            "https://wms-portal-olive.vercel.app/";

    private static final String ALLOWED_HOST =
            "wms-portal-olive.vercel.app";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setSoftInputMode(
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        );

        FrameLayout root = new FrameLayout(this);

        webView = new WebView(this);

        progressBar = new ProgressBar(
                this,
                null,
                android.R.attr.progressBarStyleHorizontal
        );

        FrameLayout.LayoutParams barParams =
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        dp(3)
                );

        root.addView(
                webView,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );

        root.addView(progressBar, barParams);
        setContentView(root);

        WebSettings settings = webView.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setLoadsImagesAutomatically(true);
        settings.setMixedContentMode(
                WebSettings.MIXED_CONTENT_NEVER_ALLOW
        );

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance()
                .setAcceptThirdPartyCookies(webView, true);

        // Support JavaScript prompts, alerts and confirmation dialogs.
        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public void onProgressChanged(
                    WebView view,
                    int newProgress
            ) {
                progressBar.setProgress(newProgress);

                progressBar.setVisibility(
                        newProgress >= 100
                                ? View.GONE
                                : View.VISIBLE
                );
            }

            @Override
            public boolean onJsPrompt(
                    WebView view,
                    String url,
                    String message,
                    String defaultValue,
                    JsPromptResult result
            ) {
                if (!isAllowedWebUrl(url)) {
                    result.cancel();
                    return true;
                }

                EditText input = new EditText(MainActivity.this);
                input.setSingleLine(true);
                input.setInputType(
                        InputType.TYPE_CLASS_TEXT
                                | InputType.TYPE_TEXT_VARIATION_PASSWORD
                );
                input.setHint("Enter password");

                if (defaultValue != null) {
                    input.setText(defaultValue);
                    input.setSelection(input.length());
                }

                LinearLayout layout =
                        new LinearLayout(MainActivity.this);

                layout.setOrientation(LinearLayout.VERTICAL);
                layout.setPadding(
                        dp(20),
                        dp(8),
                        dp(20),
                        dp(4)
                );
                layout.addView(input);

                AlertDialog dialog =
                        new AlertDialog.Builder(MainActivity.this)
                                .setTitle("WMS Authorization")
                                .setMessage(message)
                                .setView(layout)
                                .setPositiveButton(
                                        "Submit",
                                        (d, which) ->
                                                result.confirm(
                                                        input.getText()
                                                                .toString()
                                                )
                                )
                                .setNegativeButton(
                                        "Cancel",
                                        (d, which) -> result.cancel()
                                )
                                .create();

                dialog.setOnCancelListener(d -> result.cancel());
                dialog.setOnDismissListener(d -> {
                    // No additional action required here.
                });
                dialog.show();

                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {

            @Override
            public void onPageStarted(
                    WebView view,
                    String url,
                    Bitmap favicon
            ) {
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(
                    WebView view,
                    String url
            ) {
                progressBar.setVisibility(View.GONE);
            }

            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    WebResourceRequest request
            ) {
                return routeUrl(request.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    String url
            ) {
                return routeUrl(Uri.parse(url));
            }
        });

        webView.setDownloadListener(
                (url, userAgent, contentDisposition, mimetype,
                 contentLength) -> {
                    try {
                        startActivity(
                                new Intent(
                                        Intent.ACTION_VIEW,
                                        Uri.parse(url)
                                )
                        );

                        Toast.makeText(
                                this,
                                "Download browser mein khulega.",
                                Toast.LENGTH_LONG
                        ).show();

                    } catch (Exception e) {
                        Toast.makeText(
                                this,
                                "Download link open nahi ho saka.",
                                Toast.LENGTH_LONG
                        ).show();
                    }
                }
        );

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(HOME_URL);
        }
    }

    private boolean isAllowedWebUrl(String url) {
        if (url == null) {
            return false;
        }

        Uri uri = Uri.parse(url);

        String scheme = uri.getScheme() == null
                ? ""
                : uri.getScheme();

        String host = uri.getHost() == null
                ? ""
                : uri.getHost();

        return "https".equalsIgnoreCase(scheme)
                && (
                    ALLOWED_HOST.equalsIgnoreCase(host)
                    || host.endsWith(".vercel.app")
                );
    }

    private boolean routeUrl(Uri uri) {
        String scheme = uri.getScheme() == null
                ? ""
                : uri.getScheme();

        String host = uri.getHost() == null
                ? ""
                : uri.getHost();

        if (
                ("https".equalsIgnoreCase(scheme)
                        || "http".equalsIgnoreCase(scheme))
                && (
                    ALLOWED_HOST.equalsIgnoreCase(host)
                    || host.endsWith(".vercel.app")
                )
        ) {
            return false;
        }

        try {
            startActivity(
                    new Intent(Intent.ACTION_VIEW, uri)
            );
        } catch (Exception ignored) {
            Toast.makeText(
                    this,
                    "Yeh link open nahi ho saka.",
                    Toast.LENGTH_SHORT
            ).show();
        }

        return true;
    }

    private int dp(int value) {
        return (int) (
                value * getResources()
                        .getDisplayMetrics().density + 0.5f
        );
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);

        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }
}
