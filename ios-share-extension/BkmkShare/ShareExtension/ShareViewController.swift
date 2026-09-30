import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    
    
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
        label.numberOfLines = 0
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
        button.isEnabled = false
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
            
            statusLabel.topAnchor.constraint(equalTo: activityIndicator.bottomAnchor, constant: 12),
            statusLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            statusLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            
            doneButton.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 20),
            doneButton.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            doneButton.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -20)
        ])
    }
    
    private func extractURL() {
        activityIndicator.startAnimating()
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
                            } else {
                                self?.showError("No URL found in shared content")
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
                            } else {
                                self?.showError("No URL found in shared content")
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
        statusLabel.text = "Saving on this device…"
        guard let queued = SharedURLQueue.enqueue(urlString) else {
            showError("Could not save this URL. Use an http or https link.")
            return
        }

        guard let token = KeychainHelper.shared.getToken() else {
            showQueued("Saved on this device. Sign in to Bkmk to finish saving.")
            return
        }

        statusLabel.text = "Saving to Bkmk…"
        statusLabel.textColor = .secondaryLabel
        activityIndicator.startAnimating()
        Task { [weak self] in
            await self?.saveOnServer(queued, token: token)
        }
    }

    private func saveOnServer(_ item: PendingSharedURL, token: String) async {
        guard let url = URL(string: "\(AppConfig.apiBaseURL)/scrape") else {
            showQueued("Saved on this device. Open Bkmk to finish saving.")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 45
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["url": item.url])

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let response = response as? HTTPURLResponse else {
                showQueued("Saved on this device. Open Bkmk to finish saving.")
                return
            }
            switch response.statusCode {
            case 200...299:
                SharedURLQueue.remove(id: item.id)
                showSuccess("Saved to Bkmk")
            case 409:
                SharedURLQueue.remove(id: item.id)
                showSuccess("Already saved in Bkmk")
            case 401, 403:
                showQueued("Saved on this device. Sign in to Bkmk to finish saving.")
            case 400...499 where response.statusCode != 408 && response.statusCode != 429:
                SharedURLQueue.remove(id: item.id)
                showError("This URL could not be saved to Bkmk.")
            default:
                showQueued("Saved on this device. Open Bkmk to finish saving.")
            }
        } catch {
            showQueued("Saved on this device. Open Bkmk to finish saving.")
        }
    }
    
    private func showSuccess(_ message: String) {
        activityIndicator.stopAnimating()
        statusLabel.text = "✅ \(message)"
        statusLabel.textColor = .systemGreen
        doneButton.isEnabled = true
        doneButton.setTitle("Done", for: .normal)
    }

    private func showQueued(_ message: String) {
        activityIndicator.stopAnimating()
        statusLabel.text = message
        statusLabel.textColor = .secondaryLabel
        doneButton.isEnabled = true
        doneButton.setTitle("Done", for: .normal)
    }
    
    private func showError(_ message: String) {
        statusLabel.text = "❌ \(message)"
        statusLabel.textColor = .systemRed
        activityIndicator.stopAnimating()
        doneButton.isEnabled = true
        doneButton.setTitle("Close", for: .normal)
    }
    
    @objc private func doneTapped() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
