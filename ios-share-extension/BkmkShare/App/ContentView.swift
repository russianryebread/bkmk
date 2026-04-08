import SwiftUI

struct ContentView: View {
    @State private var apiToken: String = ""
    @State private var showingAlert = false
    @State private var alertMessage = ""
    @State private var isTokenSaved = false
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("API Configuration")) {
                    TextField("API Token", text: $apiToken)
                        .textContentType(.password)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                    
                    Text("Get your API token from Bkmk web app settings")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Section {
                    Button(action: saveToken) {
                        HStack {
                            Spacer()
                            Text("Save Token")
                                .fontWeight(.semibold)
                            Spacer()
                        }
                    }
                    .disabled(apiToken.isEmpty)
                }
                
                Section(header: Text("How to Use")) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("1. Open Safari on iOS")
                        Text("2. Navigate to any webpage")
                        Text("3. Tap the Share button")
                        Text("4. Select \"Save to Bkmk\"")
                        Text("5. Bookmark is saved!")
                    }
                    .font(.subheadline)
                }
                
                Section(header: Text("Server")) {
                    Text(AppConfig.apiBaseURL)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Bkmk Share")
            .alert("Token Saved", isPresented: $showingAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(alertMessage)
            }
            .onAppear {
                loadToken()
            }
        }
    }
    
    private func loadToken() {
        if let token = KeychainHelper.shared.getToken() {
            apiToken = token
        }
    }
    
    private func saveToken() {
        KeychainHelper.shared.saveToken(apiToken)
        alertMessage = "Your API token has been saved securely."
        showingAlert = true
    }
}

#Preview {
    ContentView()
}
