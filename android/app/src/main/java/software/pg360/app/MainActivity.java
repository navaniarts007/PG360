package software.pg360.app;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onStart() {
    super.onStart();
    // Expose window.PG360Print.print() so the web "Print / Save as PDF" button
    // can drive Android's print framework (which includes "Save as PDF").
    // The plain renderer window.print() is a no-op inside Android's WebView.
    WebView webView = this.getBridge().getWebView();
    webView.addJavascriptInterface(new PrintBridge(webView), "PG360Print");
  }

  public class PrintBridge {
    private final WebView webView;

    PrintBridge(WebView webView) {
      this.webView = webView;
    }

    @JavascriptInterface
    public void print() {
      runOnUiThread(() -> {
        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
        if (printManager == null) return;
        String jobName = "PG360 Document";
        PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(jobName);
        printManager.print(jobName, adapter, new PrintAttributes.Builder().build());
      });
    }
  }
}
