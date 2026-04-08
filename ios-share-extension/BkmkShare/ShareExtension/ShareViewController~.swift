import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    
    private let apiBaseURL = AppConfig.apiBaseURL
    // private let apiBaseURL = "https://bkmk.hoshor.me/api" bkmk_6g4s5v2x1t5e4v4l4k4o6b4w156j242s3x5c5g6u2f1m4j
    
    private lazy var containerView: UIView = {
        let view = UIView()
        view.backgroundColor = .systemBackground
        view.layer.cornerRadius = 16
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    private lazy var titleLabel: UILabel = {
        let label = UILabel()
        label.text = "Save to Bkmk"
        label.font = .systemFont(ofSize: 17, weight: .semibold)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var urlLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 13)
        label.textColor = .secondaryLabel
        label.textAlignment = .center
        label.numberOfLines = 2
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var statusLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 15)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var activityIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .medium)
        indicator.hidesWhenStopped = true
        indicator.translatesAutoresizingMaskIntoConstraints = false
        return indicator
    }()
    
    private lazy var doneButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Done", for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 17, weight: .medium)
        button.addTarget(self, action: #selector(doneTapped), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()
    
    private var sharedURL: String?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        extractURL()
    }
    
    private func setupUI() {
        view.backgroundColor = UIColor.black.withAlphaComponent(0.4)
        
        view.addSubview(containerView)
        containerView.addSubview(titleLabel)
        containerView.addSubview(urlLabel)
        containerView.addSubview(statusLabel)
        containerView.addSubview(activityIndicator)
        containerView.addSubview(doneButton)
        
        NSLayoutConstraint.activate([
            containerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            containerView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            containerView.widthAnchor.constraint(equalToConstant: 280),
            
            titleLabel.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 20),
            titleLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            titleLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            
            urlLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            urlLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            urlLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            
            activityIndicator.topAnchor.constraint(equalTo: urlLabel.bottomAnchor, constant: 16),
            activityIndicator.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            
            statusLabel.topAnchor.constraint(equalTo: urlLabel.bottomAnchor, constant: 16),
            statusLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            statusLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            
            doneButton.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 20),
            doneButton.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            doneButton.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -20)
        ])
    }
    
    private func extractURL() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            showError("No content to share")
            return
        }
        
        for extensionItem in extensionItems {
            guard let attachments = extensionItem.attachments else { continue }
            
            for attachment in attachments {
                // Try URL type first
                if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, error in
                        DispatchQueue.main.async {
                            if let url = item as? URL {
                                self?.sharedURL = url.absoluteString
                                self?.urlLabel.text = url.host ?? url.absoluteString
                                self?.saveBookmark()
                            } else if let error = error {
                                self?.showError("Failed to load URL: \(error.localizedDescription)")
                            }
                        }
                    }
                    return
                }
                
                // Try plain text as fallback (might contain URL)
                if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] item, error in
                        DispatchQueue.main.async {
                            if let text = item as? String, let url = URL(string: text), url.scheme != nil {
                                self?.sharedURL = text
                                self?.urlLabel.text = url.host ?? text
                                self?.saveBookmark()
                            } else if let error = error {
                                self?.showError("Failed to load text: \(error.localizedDescription)")
                            }
                        }
                    }
                    return
                }
            }
        }
        
        showError("No URL found in shared content")
    }
    
    private func saveBookmark() {
        guard let urlString = sharedURL else {
            showError("No URL to save")
            return
        }
        
        statusLabel.text = "Saving..."
        activityIndicator.startAnimating()
        
        guard let token = KeychainHelper.shared.getToken() else {
            showError("Please configure API token in the Bkmk Share app first")
            return
        }
        
        guard let url = URL(string: "\(apiBaseURL)/scrape") else {
            showError("Invalid API URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let body: [String: Any] = ["url": urlString]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.activityIndicator.stopAnimating()
                
                if let error = error {
                    self?.showError("Network error: \(error.localizedDescription)")
                    return
                }
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    self?.showError("Invalid response")
                    return
                }
                
                if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
                    self?.showSuccess("Saved!")
                } else if httpResponse.statusCode == 401 {
                    self?.showError("Invalid API token. Please update in the app.")
                } else if httpResponse.statusCode == 409 {
                    self?.showError("Already saved!")
                } else {
                    self?.showError("Server error: \(httpResponse.statusCode)")
                }
            }
        }.resume()
    }
    
    private func showSuccess(_ message: String) {
        statusLabel.text = "✅ \(message)"
        statusLabel.textColor = .systemGreen
        doneButton.setTitle("Done", for: .normal)
    }
    
    private func showError(_ message: String) {
        statusLabel.text = "❌ \(message)"
        statusLabel.textColor = .systemRed
        activityIndicator.stopAnimating()
        doneButton.setTitle("Close", for: .normal)
    }
    
    @objc private func doneTapped() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
